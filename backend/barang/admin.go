package barang

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
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

func (d *DB) AddBarang() gin.HandlerFunc {
	return func(ctx *gin.Context) {
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

		var imageURL *string
		fileHeader, err := ctx.FormFile("image")
		if err == nil && fileHeader != nil {
			uploadedURL, uploadErr := uploadToSupabaseStorage("barang2", fileHeader)
			if uploadErr != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"err": "Gagal upload gambar ke bucket: " + uploadErr.Error()})
				return
			}
			imageURL = &uploadedURL
		}

		var newID int
		var createdAt time.Time

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			query := `
				INSERT INTO inventory_items (name, total_quantity, description, created_at, image) 
				VALUES ($1, $2, $3, NOW(), $4) 
				RETURNING id, created_at
			`
			return d.Database.QueryRow(c, query, name, totalQuantity, description, imageURL).Scan(&newID, &createdAt)
		})

		if retryErr != nil {
			if imageURL != nil && *imageURL != "" {
				_ = deleteFromSupabaseStorage("barang2", *imageURL)
			}
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal menyimpan ke database", "details": retryErr.Error()})
			return
		}

		_ = redis.DelRedis("barang")

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
		cacheKey := "barang"

		cachedData, err := redis.GetREDIS(cacheKey)
		if err == nil && cachedData != "" {
			ctx.Header("Content-Type", "application/json")
			ctx.String(http.StatusOK, cachedData)
			return
		}

		var listBarang []InventoryItem

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			query := `
				SELECT id, name, total_quantity, description, created_at, COALESCE(image, '') 
				FROM inventory_items 
				ORDER BY id DESC
			`
			rows, err := d.Database.Query(c, query)
			if err != nil {
				return err
			}
			defer rows.Close()

			result := []InventoryItem{}
			for rows.Next() {
				var item InventoryItem
				var img string

				if err := rows.Scan(&item.ID, &item.Name, &item.TotalQuantity, &item.Description, &item.CreatedAt, &img); err != nil {
					return err
				}
				if img != "" {
					item.Image = &img
				}
				result = append(result, item)
			}

			if err := rows.Err(); err != nil {
				return err
			}

			listBarang = result
			return nil
		})

		if retryErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal mengambil data barang", "details": retryErr.Error()})
			return
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
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"err": "invalid input", "details": err.Error()})
			return
		}

		var imageURL *string
		var isNotFound bool

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			tx, err := d.Database.Begin(c)
			if err != nil {
				return err
			}
			defer tx.Rollback(c)

			// 1. Ambil gambar sebelum dihapus
			err = tx.QueryRow(c, `SELECT image FROM inventory_items WHERE id = $1`, req.ID).Scan(&imageURL)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					isNotFound = true
					return nil
				}
				return err
			}

			// 2. Hapus data
			tag, err := tx.Exec(c, `DELETE FROM inventory_items WHERE id = $1`, req.ID)
			if err != nil {
				return err
			}

			if tag.RowsAffected() == 0 {
				isNotFound = true
				return nil
			}

			return tx.Commit(c)
		})

		if isNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"err": "barang dengan ID tersebut tidak ditemukan"})
			return
		}

		if retryErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal menghapus data dari database", "details": retryErr.Error()})
			return
		}

		if imageURL != nil && *imageURL != "" {
			_ = deleteFromSupabaseStorage("barang2", *imageURL)
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
		cacheKey := "pinjaman"

		cachedData, err := redis.GetREDIS(cacheKey)
		if err == nil && cachedData != "" {
			ctx.Header("Content-Type", "application/json")
			ctx.String(http.StatusOK, cachedData)
			return
		}

		var listPinjaman []LoanResponse

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			query := `
				SELECT l.id, l.item_id, COALESCE(i.name, 'Barang Dihapus'), l.borrower_name, l.quantity_borrowed, 
				       l.event_name, l.planned_borrow_date, l.planned_return_date, l.status, l.borrow_date, l.return_date
				FROM inventory_loans l
				LEFT JOIN inventory_items i ON l.item_id = i.id
				ORDER BY l.id DESC
			`

			rows, err := d.Database.Query(c, query)
			if err != nil {
				return err
			}
			defer rows.Close()

			result := []LoanResponse{}
			for rows.Next() {
				var loan LoanResponse
				if err := rows.Scan(
					&loan.ID, &loan.ItemID, &loan.ItemName, &loan.BorrowerName, &loan.QuantityBorrowed,
					&loan.EventName, &loan.PlannedBorrowDate, &loan.PlannedReturnDate,
					&loan.Status, &loan.BorrowDate, &loan.ReturnDate,
				); err != nil {
					return err
				}
				result = append(result, loan)
			}

			if err := rows.Err(); err != nil {
				return err
			}

			listPinjaman = result
			return nil
		})

		if retryErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal mengambil data pinjaman", "details": retryErr.Error()})
			return
		}

		if listPinjaman == nil {
			listPinjaman = []LoanResponse{}
		}

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

		var isNotFound bool

		// 1 Query gabungan update status dan stok menggunakan CTE & CASE
		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 7*time.Second)
			defer cancel()

			tx, err := d.Database.Begin(c)
			if err != nil {
				return err
			}
			defer tx.Rollback(c)

			singleUpdateQuery := `
				WITH target_loan AS (
					SELECT item_id, quantity_borrowed, status 
					FROM inventory_loans 
					WHERE id = $1 
					FOR UPDATE
				),
				update_stock AS (
					UPDATE inventory_items i
					SET total_quantity = i.total_quantity + CASE 
						WHEN tl.status != 'APPROVED' AND $2 = 'APPROVED' THEN -tl.quantity_borrowed
						WHEN tl.status = 'APPROVED' AND $2 = 'RETURNED' THEN tl.quantity_borrowed
						ELSE 0 
					END
					FROM target_loan tl
					WHERE i.id = tl.item_id 
					  AND ((tl.status != 'APPROVED' AND $2 = 'APPROVED') OR (tl.status = 'APPROVED' AND $2 = 'RETURNED'))
					RETURNING i.id
				)
				UPDATE inventory_loans
				SET status = $2,
				    return_date = CASE WHEN $2 = 'RETURNED' THEN NOW() ELSE return_date END
				WHERE id = $1
				RETURNING id;
			`

			var loanID int
			err = tx.QueryRow(c, singleUpdateQuery, req.ID, req.Status).Scan(&loanID)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					isNotFound = true
					return nil
				}
				return err
			}

			return tx.Commit(c)
		})

		if isNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"err": "data pinjaman tidak ditemukan"})
			return
		}

		if retryErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal mengupdate status pinjaman", "details": retryErr.Error()})
			return
		}

		_ = redis.DelRedis("barang")
		_ = redis.DelRedis("pinjaman")

		ctx.JSON(http.StatusOK, gin.H{"message": "Status pinjaman berhasil diperbarui"})
	}
}

func (d *DB) RefreshB() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if err := redis.DelRedis("barang"); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "Gagal menghapus cache barang: " + err.Error()})
			return
		}
		_ = redis.DelRedis("pinjaman")
		ctx.JSON(http.StatusOK, gin.H{"message": "Cache data barang & pinjaman berhasil dibersihkan"})
	}
}
