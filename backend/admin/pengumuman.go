package admin

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"

	"encoding/json"
	"mypkk/redis"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct{
	Database *pgxpool.Pool
}

func uploadToSupabaseStorage(bucketName string, fileHeader *multipart.FileHeader) (string, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_ANON_KEY") // atau SERVICE_ROLE_KEY

	if supabaseURL == "" || supabaseKey == "" {
		return "", fmt.Errorf("URL/Key Supabase belum diatur di .env")
	}

	// Buat nama file unik
	ext := filepath.Ext(fileHeader.Filename)
	uniqueFileName := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), filepath.Base(fileHeader.Filename[:len(fileHeader.Filename)-len(ext)]), ext)

	// Buka file dari request
	file, err := fileHeader.Open()
	if err != nil {
		return "", err
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}

	// Endpoint Supabase Storage Upload API: POST /storage/v1/object/{bucket}/{path}
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucketName, uniqueFileName)
	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", supabaseURL, bucketName, uniqueFileName)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(fileBytes))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	req.Header.Set("Content-Type", fileHeader.Header.Get("Content-Type"))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gagal upload ke storage (%d): %s", resp.StatusCode, string(respBody))
	}

	return publicURL, nil
}

func (d *DB) AddPengumuman() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		title := ctx.PostForm("title")
		eventDate := ctx.PostForm("event_date")
		eventTime := ctx.PostForm("event_time")
		location := ctx.PostForm("location")
		description := ctx.PostForm("description")

		if title == "" || eventDate == "" || eventTime == "" || location == "" || description == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Semua kolom wajib diisi!"})
			return
		}

		parsedDate, err := time.Parse("2006-01-02", eventDate)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal salah, gunakan YYYY-MM-DD"})
			return
		}

		// Handle Upload Gambar jika ada
		var imageName *string
		fileHeader, err := ctx.FormFile("image")
		if err == nil && fileHeader != nil {
			uploadedName, uploadErr := uploadToSupabaseStorage("pengumuman", fileHeader)
			if uploadErr != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal upload gambar: " + uploadErr.Error()})
				return
			}
			imageName = &uploadedName
		}

		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `
			INSERT INTO public.pengumuman (title, event_date, event_time, location, description, image_name)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, created_at
		`
		var newID int
		var createdAt time.Time

		err = d.Database.QueryRow(c, query, title, parsedDate, eventTime, location, description, imageName).Scan(&newID, &createdAt)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan ke database: " + err.Error()})
			return
		}

		_ = redis.DelRedis("pengumuman")

		ctx.JSON(http.StatusCreated, gin.H{
			"message": "Pengumuman berhasil ditambahkan",
			"data": gin.H{
				"id":          newID,
				"title":       title,
				"event_date":  eventDate,
				"event_time":  eventTime,
				"location":    location,
				"description": description,
				"image_name":  imageName,
				"created_at":  createdAt,
			},
		})
	}
}

func (d *DB) CekPengumuman() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		cacheKey := "pengumuman"

		// 1. CEK CACHE REDIS
		cachedData, err := redis.GetREDIS(cacheKey)
		if err == nil && cachedData != "" {
			var listPengumuman []Pengumuman
			// Parse JSON string dari Redis ke Struct Go
			if err := json.Unmarshal([]byte(cachedData), &listPengumuman); err == nil {
				ctx.JSON(http.StatusOK, gin.H{
					"message": "Berhasil mengambil data pengumuman (Cache Hit)",
					"data":    listPengumuman,
				})
				return
			}
		}

		// 2. JIKA CACHE MISS / REDIS MATI -> QUERY KE POSTGRESQL
		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `SELECT id, title, event_date, event_time, location, description, image_name, created_at FROM public.pengumuman ORDER BY created_at DESC`
		
		rows, err := d.Database.Query(c, query)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data dari database: " + err.Error()})
			return
		}
		defer rows.Close()

		listPengumuman := []Pengumuman{}
		for rows.Next() {
			var p Pengumuman
			err := rows.Scan(&p.ID, &p.Title, &p.EventDate, &p.EventTime, &p.Location, &p.Description, &p.ImageName, &p.CreatedAt)
			if err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca baris data: " + err.Error()})
				return
			}
			listPengumuman = append(listPengumuman, p)
		}


		// 3. SIMPAN KE REDIS DALAM BENTUK JSON STRING (Expired: 24 Jam)
		jsonData, err := json.Marshal(listPengumuman)
		if err == nil {
			_ = redis.SetREDIS(cacheKey, string(jsonData), 24*time.Hour)
		}

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Berhasil mengambil data pengumuman (DB)",
			"data":    listPengumuman,
		})
	}
}

func (d *DB) DelPengumuman() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req DelPengumuman
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"err": "invalid data"})
			return
		}
		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// 1. Ambil nama gambar dari DB terlebih dahulu
		var imageName *string
		selectQuery := `SELECT image_name FROM public.pengumuman WHERE id = $1`
		err := d.Database.QueryRow(c, selectQuery, req.ID).Scan(&imageName)
		if err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Pengumuman tidak ditemukan"})
			return
		}

		// 2. Hapus data dari PostgreSQL
		query := `DELETE FROM public.pengumuman WHERE id = $1`
		res, err := d.Database.Exec(c, query, req.ID)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus pengumuman: " + err.Error()})
			return
		}
		if res.RowsAffected() == 0 {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Pengumuman dengan ID tersebut tidak ditemukan"})
			return
		}

		// 3. Jika ada gambar, hapus dari Bucket 'pengumuman' Supabase
		if imageName != nil && *imageName != "" {
			_ = deleteFromSupabaseStorage("pengumuman", *imageName)
		}

		_ = redis.DelRedis("pengumuman")

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Pengumuman dan gambar berhasil dihapus",
			"id":      req.ID,
		})
	}
}

func deleteFromSupabaseStorage(bucketName string, fileName string) error {
	if fileName == "" {
		return nil
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_ANON_KEY") // Atau SUPABASE_SERVICE_ROLE_KEY jika RLS ketat

	if supabaseURL == "" || supabaseKey == "" {
		return fmt.Errorf("URL/Key Supabase belum diatur di .env")
	}

	// Endpoint Supabase Storage Delete API: DELETE /storage/v1/object/{bucket}
	url := fmt.Sprintf("%s/storage/v1/object/%s", supabaseURL, bucketName)

	payload, err := json.Marshal(map[string][]string{
		"prefixes": {fileName},
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest("DELETE", url, bytes.NewBuffer(payload))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("gagal menghapus dari storage, status: %d", resp.StatusCode)
	}

	return nil
}

func (d*DB) RefreshP()gin.HandlerFunc{
	return func(ctx *gin.Context) {
		_=redis.DelRedis("pengumuman")
	}
}