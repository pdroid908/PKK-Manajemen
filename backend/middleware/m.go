package middleware

import (
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Ambil token dari HttpOnly Cookie
		tokenString, err := c.Cookie("admin_token")
		if err != nil || tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Akses ditolak: Cookie token tidak ditemukan!"})
			c.Abort()
			return
		}

		secretKey := []byte(os.Getenv("JWT_SECRET"))

		// 2. Parse dan Validasi Token JWT
		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("method signing tidak valid: %v", t.Header["alg"])
			}
			return secretKey, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid atau sudah kedaluwarsa!"})
			c.Abort()
			return
		}

		// 3. Simpan Claims ke Context
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("userID", claims["user_id"])
			c.Set("username", claims["username"])
		}

		c.Next()
	}
}