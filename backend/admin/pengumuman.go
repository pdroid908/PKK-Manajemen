package admin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"mypkk/database"
	"mypkk/redis"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Database *pgxpool.Pool
}

func uploadToSupabaseStorage(bucketName string, fileHeader *multipart.FileHeader) (string, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_ANON_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		return "", fmt.Errorf("URL/Key Supabase belum diatur di .env")
	}

	ext := filepath.Ext(fileHeader.Filename)
	uniqueFileName := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), filepath.Base(fileHeader.Filename[:len(fileHeader.Filename)-len(ext)]), ext)

	file, err := fileHeader.Open()
	if err != nil {
		return "", err
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}

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

		var newID int
		var createdAt time.Time

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			query := `
				INSERT INTO public.pengumuman (title, event_date, event_time, location, description, image_name)
				VALUES ($1, $2, $3, $4, $5, $6)
				RETURNING id, created_at
			`
			return d.Database.QueryRow(c, query, title, parsedDate, eventTime, location, description, imageName).Scan(&newID, &createdAt)
		})

		if retryErr != nil {
			if imageName != nil && *imageName != "" {
				_ = deleteFromSupabaseStorage("pengumuman", *imageName)
			}
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan ke database: " + retryErr.Error()})
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

		cachedData, err := redis.GetREDIS(cacheKey)
		if err == nil && cachedData != "" {
			var listPengumuman []Pengumuman
			if err := json.Unmarshal([]byte(cachedData), &listPengumuman); err == nil {
				ctx.JSON(http.StatusOK, gin.H{
					"message": "Berhasil mengambil data pengumuman (Cache Hit)",
					"data":    listPengumuman,
				})
				return
			}
		}

		var listPengumuman []Pengumuman

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			query := `SELECT id, title, event_date, event_time, location, description, image_name, created_at FROM public.pengumuman ORDER BY created_at DESC`
			
			rows, err := d.Database.Query(c, query)
			if err != nil {
				return err
			}
			defer rows.Close()

			result := []Pengumuman{}
			for rows.Next() {
				var p Pengumuman
				if err := rows.Scan(&p.ID, &p.Title, &p.EventDate, &p.EventTime, &p.Location, &p.Description, &p.ImageName, &p.CreatedAt); err != nil {
					return err
				}
				result = append(result, p)
			}

			if err := rows.Err(); err != nil {
				return err
			}

			listPengumuman = result
			return nil
		})

		if retryErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data dari database: " + retryErr.Error()})
			return
		}

		if jsonData, err := json.Marshal(listPengumuman); err == nil {
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

		var imageName *string
		var isNotFound bool
		var isDeleted bool

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			tx, err := d.Database.Begin(c)
			if err != nil {
				return err
			}
			defer tx.Rollback(c)

			selectQuery := `SELECT image_name FROM public.pengumuman WHERE id = $1`
			err = tx.QueryRow(c, selectQuery, req.ID).Scan(&imageName)
			if err != nil {
				if err == pgx.ErrNoRows {
					isNotFound = true
					return nil
				}
				return err
			}

			query := `DELETE FROM public.pengumuman WHERE id = $1`
			res, err := tx.Exec(c, query, req.ID)
			if err != nil {
				return err
			}

			if res.RowsAffected() == 0 {
				isNotFound = true
				return nil
			}

			if err := tx.Commit(c); err != nil {
				return err
			}

			isDeleted = true
			return nil
		})

		if isNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Pengumuman tidak ditemukan"})
			return
		}

		if retryErr != nil || !isDeleted {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus pengumuman: " + retryErr.Error()})
			return
		}

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
	supabaseKey := os.Getenv("SUPABASE_ANON_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		return fmt.Errorf("URL/Key Supabase belum diatur di .env")
	}

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

func (d *DB) RefreshP() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if err := redis.DelRedis("pengumuman"); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus cache pengumuman: " + err.Error()})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"message": "Cache data pengumuman berhasil dibersihkan"})
	}
}
