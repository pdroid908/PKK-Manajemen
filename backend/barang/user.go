package barang

import (
	"context"
	"mypkk/redis"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
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

		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `
			INSERT INTO inventory_loans (item_id, borrower_name, quantity_borrowed, event_name, planned_borrow_date, planned_return_date, status, borrow_date) 
			VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW()) 
			RETURNING id, borrow_date
		`

		var loanID int
		var borrowDate time.Time
		err := d.Database.QueryRow(c, query, 
			req.ItemID, req.BorrowerName, req.QuantityBorrowed, 
			req.EventName, req.PlannedBorrowDate, req.PlannedReturnDate,
		).Scan(&loanID, &borrowDate)

		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal menyimpan pengajuan pinjaman", "details": err.Error()})
			return
		}

		_ = redis.DelRedis("pinjaman")
		_ = redis.DelRedis("barang")

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Pengajuan pinjaman berhasil dikirim dan menunggu persetujuan admin",
			"data":    req,
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

		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Cek status terlebih dahulu: jika sebelumnya sudah APPROVED, stok harus dikembalikan dulu sebelum dihapus
		var currentStatus string
		var itemID, qty int
		err := d.Database.QueryRow(c, `SELECT status, item_id, quantity_borrowed FROM inventory_loans WHERE id = $1`, req.ID).Scan(&currentStatus, &itemID, &qty)
		
		tx, errTx := d.Database.Begin(c)
		if errTx != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal memulai transaksi"})
			return
		}
		defer tx.Rollback(c)

		// Jika data yang dihapus tadinya berstatus APPROVED, kembalikan stok barangnya
		if err == nil && currentStatus == "APPROVED" {
			_, err = tx.Exec(c, `UPDATE inventory_items SET total_quantity = total_quantity + $1 WHERE id = $2`, qty, itemID)
			if err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal mengembalikan stok barang"})
				return
			}
		}

		// Hapus data pinjaman
		tag, err := tx.Exec(c, `DELETE FROM inventory_loans WHERE id = $1`, req.ID)
		if err != nil || tag.RowsAffected() == 0 {
			ctx.JSON(http.StatusNotFound, gin.H{"err": "data pinjaman tidak ditemukan atau gagal dihapus"})
			return
		}

		if err := tx.Commit(c); err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"err": "gagal commit transaksi"})
			return
		}

		// Bersihkan cache Redis
		_ = redis.DelRedis("pinjaman")
		_ = redis.DelRedis("barang")

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Pengajuan pinjaman berhasil dihapus",
			"id":      req.ID,
		})
	}
}