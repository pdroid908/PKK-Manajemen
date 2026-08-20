package middleware

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Database struct {
	Db *pgxpool.Pool
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (d *Database) Login() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req LoginRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Username dan Password wajib diisi!"})
			return
		}

		c, cancel := context.WithTimeout(ctx.Request.Context(), 5*time.Second)
		defer cancel()

		var id string // ID bertipe UUID disimpan dalam string
		var storedHash string

		// 1. Query ke tabel public.pengguna
		query := `SELECT id, password_hash FROM public.pengguna WHERE username = $1 LIMIT 1`
		err := d.Db.QueryRow(c, query, req.Username).Scan(&id, &storedHash)
		if err != nil {
			if err == pgx.ErrNoRows {
				ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau Password salah!"})
				return
			}
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memproses data: " + err.Error()})
			return
		}

		// 2. Verifikasi Password dengan Bcrypt Hash
		if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.Password)); err != nil {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau Password salah!"})
			return
		}

		// 3. Generate JWT Token
		secretKey := []byte(os.Getenv("JWT_SECRET"))
		claims := jwt.MapClaims{
			"user_id":  id,
			"username": req.Username,
			"exp":      time.Now().Add(24 * time.Hour).Unix(), // Token berlaku 24 jam
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString(secretKey)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat token autentikasi"})
			return
		}

		// Set SameSite None untuk Cross-Domain (misal Frontend Vercel & Backend Vercel/VPS)
		ctx.SetSameSite(http.SameSiteNoneMode)

		// Set HTTP-Only Cookie (Nama cookie: "admin_token", Durasi: 24 Jam / 86400 detik)
		// Parameter: (name, value, maxAge, path, domain, secure, httpOnly)
		ctx.SetCookie("admin_token", tokenString, 86400, "/", "", true, true)

		ctx.JSON(http.StatusOK, gin.H{
			"message": "Login berhasil",
		})
	}
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password_hash" binding:"required"`
}

func (d *Database) Register() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		var req RegisterRequest
		if err := ctx.ShouldBindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Username dan Password wajib diisi!"})
			return
		}

		// 1. Hash Password menggunakan Bcrypt (Cost 10)
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengenkripsi password"})
			return
		}

		c, cancel := context.WithTimeout(ctx.Request.Context(), 5*time.Second)
		defer cancel()

		// 2. Simpan ke database public.pengguna
		query := `INSERT INTO public.pengguna (username, password_hash) VALUES ($1, $2)`
		_, err = d.Db.Exec(c, query, req.Username, string(hashedPassword))
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mendaftarkan user (Username mungkin sudah digunakan): " + err.Error()})
			return
		}

		ctx.JSON(http.StatusCreated, gin.H{
			"message": "User berhasil terdaftar! Silakan login.",
		})
	}
}