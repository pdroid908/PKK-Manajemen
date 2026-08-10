package barang

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"

	"mypkk/redis"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct{
	Database * pgxpool.Pool
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

func (d *DB) AddBarang() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		// 1. Ambil data form text
		name := ctx.PostForm("name")
		totalQuantityStr := ctx.PostForm("total_quantity")
		description := ctx.PostForm("description")

		if name == "" || totalQuantityStr == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"err": "Nama dan jumlah barang wajib diisi!"})
			return
		}

		totalQuantity, err := strconv.Atoi(totalQuantityStr)
		if err != nil || totalQuantity < 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"err": "Jumlah barang harus berupa angka valid!"})
			return
		}

		// 2. Handle Upload Gambar ke Bucket 'barang2' Supabase (Opsional)
		var imageURL *string
		fileHeader, err := ctx.FormFile("image")
		// Pengecekan aman agar tidak error 400 jika pengguna tidak memasukkan foto
		if err == nil && fileHeader != nil {
			uploadedURL, uploadErr := uploadToSupabaseStorage("barang2", fileHeader)
			if uploadErr != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"err": "Gagal upload gambar ke bucket: " + uploadErr.Error()})
				return
			}
			imageURL = &uploadedURL
		}

		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// 3. Query insert disesuaikan urutannya dengan SQL Table:
		// name, total_quantity, description, created_at, image
		query := `
			INSERT INTO inventory_items (name, total_quantity, description, created_at, image) 
			VALUES ($1, $2, $3, NOW(), $4) 
			RETURNING id, created_at
		`

		var newID int
		var createdAt time.Time

		err = d.Database.QueryRow(c, query, name, totalQuantity, description, imageURL).Scan(&newID, &createdAt)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal menyimpan ke database", "details": err.Error()})
			return
		}

		_ = redis.DelRedis("barang")

		// 4. Respons Sukses
		ctx.JSON(http.StatusOK, gin.H{
			"message": "Barang inventaris berhasil ditambahkan",
			"data": gin.H{
				"id":             newID,
				"name":           name,
				"total_quantity": totalQuantity,
				"description":    description,
				"image":          imageURL,
				"created_at":     createdAt,
			},
		})
	}
}

func (d *DB) GetBarang() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		cacheKey := "barang"

		cachedData, err := redis.GetREDIS(cacheKey)
		if err == nil && cachedData != "" {
			ctx.Header("Content-Type", "application/json")
			ctx.String(http.StatusOK, cachedData)
			return
		}

		// 1. SESUAIKAN URUTAN SELECT DENGAN SQL TABLE: id, name, total_quantity, description, created_at, image
		query := `
			SELECT id, name, total_quantity, description, created_at, COALESCE(image, '') 
			FROM inventory_items 
			ORDER BY id DESC
		`
		rows, err := d.Database.Query(c, query)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal mengambil data barang", "details": err.Error()})
			return
		}
		defer rows.Close()

		var listBarang []InventoryItem
		for rows.Next() {
			var item InventoryItem
			var img string
			
			// 2. SESUAIKAN URUTAN SCAN: &item.CreatedAt TERLEBIH DAHULU, KEMUDIAN &img
			if err := rows.Scan(&item.ID, &item.Name, &item.TotalQuantity, &item.Description, &item.CreatedAt, &img); err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal membaca data barang", "details": err.Error()})
				return
			}
			if img != "" {
				item.Image = &img
			}
			listBarang = append(listBarang, item)
		}

		if listBarang == nil {
			listBarang = []InventoryItem{}
		}

		jsonBytes, err := json.Marshal(listBarang)
		if err == nil {
			_ = redis.SetREDIS(cacheKey, string(jsonBytes), 0)
		}

		ctx.JSON(http.StatusOK, listBarang)
	}
}

func (d *DB) DelBArang() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req DelInventory
		err := ctx.ShouldBindJSON(&req)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"err": "invalid input", "details": err.Error()})
			return
		}

		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `DELETE FROM inventory_items WHERE id = $1`

		tag, err := d.Database.Exec(c, query, req.ID)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal menghapus data dari database", "details": err.Error()})
			return
		}

		if tag.RowsAffected() == 0 {
			ctx.JSON(http.StatusNotFound, gin.H{"err": "barang dengan ID tersebut tidak ditemukan"})
			return
		}

		_ = redis.DelRedis("barang")

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Barang inventaris berhasil dihapus",
			"id":      req.ID,
		})
	}
}


func (d *DB) GetPinjaman() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		cacheKey := "pinjaman"

		// 1. Cek apakah data sudah ada di Redis Cache
		cachedData, err := redis.GetREDIS(cacheKey)
		if err == nil && cachedData != "" {
			ctx.Header("Content-Type", "application/json")
			ctx.String(http.StatusOK, cachedData)
			return
		}

		// 2. Jika belum ada di cache, ambil dari Database PostgreSQL
		query := `
			SELECT l.id, l.item_id, COALESCE(i.name, 'Barang Dihapus'), l.borrower_name, l.quantity_borrowed, 
			       l.event_name, l.planned_borrow_date, l.planned_return_date, l.status, l.borrow_date, l.return_date
			FROM inventory_loans l
			LEFT JOIN inventory_items i ON l.item_id = i.id
			ORDER BY l.id DESC
		`

		rows, err := d.Database.Query(c, query)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal mengambil data pinjaman", "details": err.Error()})
			return
		}
		defer rows.Close()

		var listPinjaman []LoanResponse
		for rows.Next() {
			var loan LoanResponse
			if err := rows.Scan(
				&loan.ID, &loan.ItemID, &loan.ItemName, &loan.BorrowerName, &loan.QuantityBorrowed,
				&loan.EventName, &loan.PlannedBorrowDate, &loan.PlannedReturnDate,
				&loan.Status, &loan.BorrowDate, &loan.ReturnDate,
			); err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal membaca data pinjaman", "details": err.Error()})
				return
			}
			listPinjaman = append(listPinjaman, loan)
		}

		if listPinjaman == nil {
			listPinjaman = []LoanResponse{}
		}

		// 3. Simpan hasil query ke Redis Cache agar request berikutnya lebih cepat
		jsonBytes, err := json.Marshal(listPinjaman)
		if err == nil {
			_ = redis.SetREDIS(cacheKey, string(jsonBytes), 0)
		}

		ctx.JSON(http.StatusOK, listPinjaman)
	}
}

func (d *DB) UpdateLoanStatus() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req UpdateLoanStatusRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"err": "invalid input", "details": err.Error()})
			return
		}

		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Ambil data loan berdasarkan req.ID dari body JSON
		var itemID, qty int
		var currentStatus string
		err := d.Database.QueryRow(c, `SELECT item_id, quantity_borrowed, status FROM inventory_loans WHERE id = $1`, req.ID).Scan(&itemID, &qty, &currentStatus)
		if err != nil {
			ctx.JSON(http.StatusNotFound, gin.H{"err": "data pinjaman tidak ditemukan"})
			return
		}

		// Mulai Transaction Database agar aman
		tx, err := d.Database.Begin(c)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal memulai transaksi"})
			return
		}
		defer tx.Rollback(c)

		// Logika pengurangan / pengembalian stok
		if currentStatus != "APPROVED" && req.Status == "APPROVED" {
			// Kurangi stok barang karena disetujui
			_, err = tx.Exec(c, `UPDATE inventory_items SET total_quantity = total_quantity - $1 WHERE id = $2`, qty, itemID)
			if err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"err": "stok tidak cukup atau gagal mengurangi stok"})
				return
			}
		} else if currentStatus == "APPROVED" && req.Status == "RETURNED" {
			// Kembalikan stok barang karena sudah dikembalikan
			_, err = tx.Exec(c, `UPDATE inventory_items SET total_quantity = total_quantity + $1 WHERE id = $2`, qty, itemID)
			if err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal mengembalikan stok"})
				return
			}
		}

		// Update status pinjaman berdasarkan req.ID
		var returnDateClause = ""
		if req.Status == "RETURNED" {
			returnDateClause = ", return_date = NOW()"
		}

		updateQuery := fmt.Sprintf(`UPDATE inventory_loans SET status = $1 %s WHERE id = $2`, returnDateClause)
		_, err = tx.Exec(c, updateQuery, req.Status, req.ID)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal mengupdate status pinjaman"})
			return
		}

		if err := tx.Commit(c); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal commit transaksi"})
			return
		}

		_ = redis.DelRedis("barang")
		_ = redis.DelRedis("pinjaman")

		ctx.JSON(http.StatusOK, gin.H{"message": "Status pinjaman berhasil diperbarui"})
	}
}

func (d*DB) RefreshB()gin.HandlerFunc{
	return func( ctx *gin.Context){
		_ = redis.DelRedis("barang")
	}
}