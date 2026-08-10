package warga

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"mypkk/redis" // Package internal Redis kamu

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Database *pgxpool.Pool
}

const cacheKeyWarga = "warga:all"

// 1. GET WARGA (Untuk Admin & Frontend)
func (d *DB) GetWarga() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		// Cek parameter query untuk filter: ?aktif=true
		onlyAktif := ctx.Query("aktif") == "true"
		cacheKey := cacheKeyWarga
		if onlyAktif {
			cacheKey = "warga:aktif"
		}

		// 1. Coba ambil data dari Redis Cache
		cachedData, err := redis.GetREDIS(cacheKey)
		if err == nil && cachedData != "" {
			var wargaList []Warga
			if jsonErr := json.Unmarshal([]byte(cachedData), &wargaList); jsonErr == nil {
				ctx.JSON(http.StatusOK, gin.H{
					"source": "cache",
					"data":   wargaList,
				})
				return
			}
		}

		// 2. Jika Cache kosong atau Redis mati, ambil data dari PostgreSQL
		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `SELECT id, nama, rt_rw, no_hp, is_aktif, created_at FROM public.warga`
		if onlyAktif {
			query += ` WHERE is_aktif = true`
		}
		query += ` ORDER BY nama ASC`

		rows, err := d.Database.Query(c, query)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data database"})
			return
		}
		defer rows.Close()

		var listWarga []Warga
		for rows.Next() {
			var w Warga
			if err := rows.Scan(&w.ID, &w.Nama, &w.RtRw, &w.NoHp, &w.IsAktif, &w.CreatedAt); err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parsing data database"})
				return
			}
			listWarga = append(listWarga, w)
		}

		// 3. Simpan data baru ke Redis Cache (TTL: 1 Jam)
		if jsonData, err := json.Marshal(listWarga); err == nil {
			_ = redis.SetREDIS(cacheKey, jsonData, 1*time.Hour)
		}

		ctx.JSON(http.StatusOK, gin.H{
			"source": "database",
			"data":   listWarga,
		})
	}
}

// 2. ADD WARGA (Insert Warga Baru)
func (d *DB) AddWarga() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req CreateWargaRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak valid"})
			return
		}

		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if req.RtRw == "" {
			req.RtRw = "RT 01/RW 01"
		}

		query := `
			INSERT INTO public.warga (nama, rt_rw, no_hp)
			VALUES ($1, $2, $3)
			RETURNING id, nama, rt_rw, no_hp, is_aktif, created_at
		`

		var w Warga
		err := d.Database.QueryRow(c, query, req.Nama, req.RtRw, req.NoHp).Scan(
			&w.ID, &w.Nama, &w.RtRw, &w.NoHp, &w.IsAktif, &w.CreatedAt,
		)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan data ke database"})
			return
		}

		// Invalidate Cache karena ada data baru
		_ = redis.DelRedis("warga:all")
		_ = redis.DelRedis("warga:aktif")

		ctx.JSON(http.StatusCreated, gin.H{
			"message": "Warga berhasil ditambahkan",
			"data":    w,
		})
	}
}

// 3. DEL WARGA (Soft Delete - Ubah is_aktif jadi false)
func (d *DB) DelWarga() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		wargaID := ctx.Param("id")
		if wargaID == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "ID Warga tidak boleh kosong"})
			return
		}

		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `UPDATE public.warga SET is_aktif = false WHERE id = $1`

		tag, err := d.Database.Exec(c, query, wargaID)
		if err != nil || tag.RowsAffected() == 0 {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus warga atau ID tidak ditemukan"})
			return
		}

		// Invalidate Cache karena ada perubahan status warga
		_ = redis.DelRedis("warga:all")
		_ = redis.DelRedis("warga:aktif")

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Warga berhasil dinonaktifkan (Soft Delete)",
		})
	}
}

func RefreshW()gin.HandlerFunc{
	return func(ctx *gin.Context) {
		_ = redis.DelRedis("warga:all")
		_ = redis.DelRedis("warga:aktif")

	}
}

// 4. RESTORE WARGA (Ubah is_aktif jadi true)
func (d *DB) RestoreWarga() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		wargaID := ctx.Param("id")
		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `UPDATE public.warga SET is_aktif = true WHERE id = $1`
		tag, err := d.Database.Exec(c, query, wargaID)
		if err != nil || tag.RowsAffected() == 0 {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengaktifkan kembali warga"})
			return
		}

		_ = redis.DelRedis("warga:all")
		_ = redis.DelRedis("warga:aktif")

		ctx.JSON(http.StatusOK, gin.H{"message": "Warga berhasil diaktifkan kembali"})
	}
}

// 5. HARD DELETE WARGA (Hapus Permanen dari DB)
func (d *DB) HardDelWarga() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		wargaID := ctx.Param("id")
		c, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `DELETE FROM public.warga WHERE id = $1`
		tag, err := d.Database.Exec(c, query, wargaID)
		if err != nil || tag.RowsAffected() == 0 {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus permanen data warga"})
			return
		}

		_ = redis.DelRedis("warga:all")
		_ = redis.DelRedis("warga:aktif")

		ctx.JSON(http.StatusOK, gin.H{"message": "Data warga berhasil dihapus permanen"})
	}
}