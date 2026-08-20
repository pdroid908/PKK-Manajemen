package barang

import (
	"context"
	"errors"
	"net/http"
	"time"

	"mypkk/database"
	"mypkk/redis"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func (d *DB) AddPinjam() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req AddLoanRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"err": "invalid input", "details": err.Error()})
			return
		}

		if req.QuantityBorrowed <= 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"err": "Jumlah pinjaman harus lebih dari 0!"})
			return
		}

		var loanID int
		var borrowDate time.Time

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			query := `
				INSERT INTO inventory_loans (item_id, borrower_name, quantity_borrowed, event_name, planned_borrow_date, planned_return_date, status, borrow_date) 
				VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW()) 
				RETURNING id, borrow_date
			`

			return d.Database.QueryRow(c, query,
				req.ItemID, req.BorrowerName, req.QuantityBorrowed,
				req.EventName, req.PlannedBorrowDate, req.PlannedReturnDate,
			).Scan(&loanID, &borrowDate)
		})

		if retryErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal menyimpan pengajuan pinjaman", "details": retryErr.Error()})
			return
		}

		_ = redis.DelRedis("pinjaman")
		_ = redis.DelRedis("barang")

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Pengajuan pinjaman berhasil dikirim dan menunggu persetujuan admin",
			"data": gin.H{
				"id":                  loanID,
				"item_id":             req.ItemID,
				"borrower_name":       req.BorrowerName,
				"quantity_borrowed":   req.QuantityBorrowed,
				"event_name":          req.EventName,
				"planned_borrow_date": req.PlannedBorrowDate,
				"planned_return_date": req.PlannedReturnDate,
				"borrow_date":         borrowDate,
			},
		})
	}
}

func (d *DB) DelPinjaman() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req DelLoanRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"err": "invalid input", "details": err.Error()})
			return
		}

		var isNotFound bool

		retryErr := database.RetryDB(ctx.Request.Context(), database.DefaultRetryConfig(), func(reqCtx context.Context) error {
			c, cancel := context.WithTimeout(reqCtx, 5*time.Second)
			defer cancel()

			tx, err := d.Database.Begin(c)
			if err != nil {
				return err
			}
			defer tx.Rollback(c)

			// 1. Ambil data pinjaman & kunci baris (FOR UPDATE) untuk menghindari race condition
			var currentStatus string
			var itemID, qty int
			err = tx.QueryRow(c, `SELECT status, item_id, quantity_borrowed FROM inventory_loans WHERE id = $1 FOR UPDATE`, req.ID).Scan(&currentStatus, &itemID, &qty)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					isNotFound = true
					return nil
				}
				return err
			}

			// 2. Jika status barang APPROVED, kembalikan stoknya terlebih dahulu
			if currentStatus == "APPROVED" {
				_, err = tx.Exec(c, `UPDATE inventory_items SET total_quantity = total_quantity + $1 WHERE id = $2`, qty, itemID)
				if err != nil {
					return err
				}
			}

			// 3. Hapus data pinjaman
			tag, err := tx.Exec(c, `DELETE FROM inventory_loans WHERE id = $1`, req.ID)
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
			ctx.JSON(http.StatusNotFound, gin.H{"err": "data pinjaman tidak ditemukan"})
			return
		}

		if retryErr != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal menghapus pengajuan pinjaman", "details": retryErr.Error()})
			return
		}

		_ = redis.DelRedis("pinjaman")
		_ = redis.DelRedis("barang")

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Pengajuan pinjaman berhasil dihapus",
			"id":      req.ID,
		})
	}
}
