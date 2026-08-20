package admin

import (
	"context"
	"encoding/json"
	"mypkk/database"
	"mypkk/redis"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func (d *DB) DataKeuangan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		cacheKey := "Data_keuangan"

		// 1. CEK CACHE REDIS
		cachedData, err := redis.GetREDIS(cacheKey)
		if err == nil && cachedData != "" {
			var listKeuangan []FinanceTransaction
			if err := json.Unmarshal([]byte(cachedData), &listKeuangan); err == nil {
				ctx.JSON(http.StatusOK, gin.H{
					"message": "Berhasil mengambil data keuangan (Cache Hit)",
					"data":    listKeuangan,
				})
				return
			}
		}

		// 2. QUERY KE POSTGRESQL (Menggunakan RetryDB)
		var listKeuangan []FinanceTransaction

		err = database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			query := `
				SELECT id, title, type, amount, balance_after, COALESCE(proof_image, ''), transaction_date 
				FROM public.finance_transactions 
				ORDER BY transaction_date ASC, id ASC
			`

			rows, err := d.Database.Query(c, query)
			if err != nil {
				return err
			}
			defer rows.Close()

			result := []FinanceTransaction{}
			for rows.Next() {
				var f FinanceTransaction
				err := rows.Scan(
					&f.ID,
					&f.Title,
					&f.Type,
					&f.Amount,
					&f.BalanceAfter,
					&f.ProofImage,
					&f.TransactionDate,
				)
				if err != nil {
					return err
				}
				result = append(result, f)
			}

			if err := rows.Err(); err != nil {
				return err
			}

			listKeuangan = result
			return nil
		})

		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data keuangan dari database: " + err.Error()})
			return
		}

		// 3. SIMPAN KE REDIS DALAM BENTUK JSON STRING
		jsonData, err := json.Marshal(listKeuangan)
		if err == nil {
			_ = redis.SetREDIS(cacheKey, string(jsonData), 24*time.Hour)
		}

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Berhasil mengambil data keuangan (DB)",
			"data":    listKeuangan,
		})
	}
}

func (d *DB) AddKeuangan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		// Menerima multipart/form-data
		title := ctx.PostForm("title")
		txType := ctx.PostForm("type")
		amountStr := ctx.PostForm("amount")

		if title == "" || txType == "" || amountStr == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Title, type, dan amount wajib diisi!"})
			return
		}

		if txType != "INCOME" && txType != "EXPENSE" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Type harus 'INCOME' atau 'EXPENSE'"})
			return
		}

		amount, err := strconv.ParseFloat(amountStr, 64)
		if err != nil || amount <= 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Amount harus berupa angka positif valid"})
			return
		}

		// Handle Upload File Gambar Bukti Nota (ke Bucket "bukti-transaksi")
		var imageName string
		fileHeader, err := ctx.FormFile("proof_image")
		if err == nil && fileHeader != nil {
			uploadedName, uploadErr := uploadToSupabaseStorage("bukti-transaksi", fileHeader)
			if uploadErr != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal upload bukti nota: " + uploadErr.Error()})
				return
			}
			imageName = uploadedName
		}

		var newID uint
		var newBalance float64
		now := time.Now()

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			var lastBalance float64 = 0
			lastTxQuery := `SELECT balance_after FROM public.finance_transactions ORDER BY transaction_date DESC, id DESC LIMIT 1`
			_ = d.Database.QueryRow(c, lastTxQuery).Scan(&lastBalance)

			if txType == "INCOME" {
				newBalance = lastBalance + amount
			} else {
				newBalance = lastBalance - amount
			}

			insertQuery := `
				INSERT INTO public.finance_transactions (title, type, amount, balance_after, proof_image, transaction_date)
				VALUES ($1, $2, $3, $4, $5, $6)
				RETURNING id
			`

			return d.Database.QueryRow(
				c,
				insertQuery,
				title,
				txType,
				amount,
				newBalance,
				imageName,
				now,
			).Scan(&newID)
		})

		if retryErr != nil {
			if imageName != "" {
				_ = deleteFromSupabaseStorage("bukti-transaksi", imageName)
			}
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan transaksi keuangan: " + retryErr.Error()})
			return
		}

		_ = redis.DelRedis("Data_keuangan")

		ctx.JSON(http.StatusCreated, gin.H{
			"message": "Transaksi keuangan berhasil ditambahkan",
			"data": FinanceTransaction{
				ID:              newID,
				Title:           title,
				Type:            txType,
				Amount:          amount,
				BalanceAfter:    newBalance,
				ProofImage:      imageName,
				TransactionDate: now,
			},
		})
	}
}

func (d *DB) DelKeuangan() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req DelFinance
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data request tidak valid: " + err.Error()})
			return
		}

		var proofImage string
		var isNotFound bool

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 10*time.Second)
			defer cancel()

			tx, err := d.Database.Begin(c)
			if err != nil {
				return err
			}
			defer tx.Rollback(c)

			// 1. Ambil detail transaksi yang mau dihapus
			var targetType string
			var targetAmount float64
			err = tx.QueryRow(c, `SELECT type, amount, COALESCE(proof_image, '') FROM public.finance_transactions WHERE id = $1`, req.ID).Scan(&targetType, &targetAmount, &proofImage)
			if err != nil {
				isNotFound = true
				return err
			}

			// 2. Hapus datanya
			_, err = tx.Exec(c, `DELETE FROM public.finance_transactions WHERE id = $1`, req.ID)
			if err != nil {
				return err
			}

			// 3. Tentukan penyesuaian saldo (Keluaran dihapus = Saldo bertambah, Masukan dihapus = Saldo berkurang)
			var delta float64
			if targetType == "EXPENSE" {
				delta = targetAmount
			} else {
				delta = -targetAmount
			}

			// 4. CUKUP UPDATE TRANSAKSI SETELAHNYA (Satu Query Efisien)
			updateQuery := `
				UPDATE public.finance_transactions 
				SET balance_after = balance_after + $1 
				WHERE id > $2
			`
			_, err = tx.Exec(c, updateQuery, delta, req.ID)
			if err != nil {
				return err
			}

			return tx.Commit(c)
		})

		if isNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Data tidak ditemukan"})
			return
		}

		if retryErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data"})
			return
		}

		// 5. Cleanup Storage & Redis
		if proofImage != "" {
			_ = deleteFromSupabaseStorage("bukti-transaksi", proofImage)
		}
		_ = redis.DelRedis("Data_keuangan")

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Transaksi berhasil dihapus dan saldo diperbarui secara efisien",
			"id":      req.ID,
		})
	}
}

func (d *DB) RefreshK() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		_ = redis.DelRedis("Data_keuangan")
	}
}