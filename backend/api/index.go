package handler

import (
	"log"
	"net/http"

	"mypkk/admin"
	"mypkk/barang"
	"mypkk/database"
	"mypkk/middleware"
	"mypkk/redis"
	"mypkk/warga"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var app *gin.Engine

func init() {
	_ = godotenv.Load()

	gin.SetMode(gin.ReleaseMode)
	app = gin.New()
	app.Use(gin.Recovery())

	app.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return true
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	app.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "API PKK Management Serverless Running Perfectly!",
		})
	})

	app.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "OK"})
	})

	NewDB, err := database.OnDB()
	if err != nil || NewDB == nil {
		log.Printf("[ERROR] Gagal menginisialisasi database: %v", err)
		return
	}
	log.Println("[INFO] Database Serverless berhasil terhubung!")

	redis.ONRedis()

	AdminDb := &admin.DB{
		Database: NewDB.Database,
	}

	BarangDb := &barang.DB{
		Database: NewDB.Database,
	}

	WargaDb := &warga.DB{
		Database: NewDB.Database,
	}

	AuthDb := &middleware.Database{
		Db: NewDB.Database,
	}

	// --- PUBLIC API ROUTES ---
	apiPublic := app.Group("/api")
	{
		apiPublic.POST("/login", AuthDb.Login())
		apiPublic.POST("/register", AuthDb.Register())

		// Warga (Public)
		apiPublic.POST("/warga/add", WargaDb.AddWarga())
		apiPublic.PUT("/warga/update/:id", WargaDb.DelWarga())
		apiPublic.GET("/warga/data", WargaDb.GetWarga())
		apiPublic.POST("/warga/refresh", warga.RefreshW())
		apiPublic.PUT("/warga/restore/:id", WargaDb.RestoreWarga())
		apiPublic.DELETE("/warga/delete/:id", WargaDb.HardDelWarga())

		// Pinjam Barang (Public)
		apiPublic.POST("/user/pinjam", BarangDb.AddPinjam())
	}

	// --- PROTECTED ADMIN API ROUTES (/api/admin) ---
	adminGroup := app.Group("/api/admin")
	adminGroup.Use(middleware.AuthMiddleware())
	{
		// Admin Pengumuman
		adminGroup.POST("/add/dashboard", AdminDb.AddPengumuman())
		adminGroup.GET("/pengumuman", AdminDb.CekPengumuman()) // URL: /api/admin/pengumuman
		adminGroup.DELETE("/delet", AdminDb.DelPengumuman())

		// Admin Barang
		adminGroup.POST("/barang", BarangDb.AddBarang())
		adminGroup.GET("/barang", BarangDb.GetBarang())
		adminGroup.DELETE("/barang", BarangDb.DelBArang())

		// Admin Peminjam
		adminGroup.GET("/peminjam", BarangDb.GetPinjaman())

		// Admin Keuangan
		adminGroup.POST("/amount", AdminDb.AddKeuangan())
		adminGroup.GET("/data/amount", AdminDb.DataKeuangan())
		adminGroup.DELETE("/data/amount", AdminDb.DelKeuangan())

		// Refresh & Utility Actions
		adminGroup.POST("/pengumuman/refresh", AdminDb.RefreshP())
		adminGroup.POST("/barang/refresh", BarangDb.RefreshB())
		adminGroup.DELETE("/barang/peminjaman", BarangDb.DelPinjaman())
		adminGroup.PUT("/barang/update", BarangDb.UpdateLoanStatus())
		adminGroup.POST("/keuangan/refresh", AdminDb.RefreshK())
	}
}

func Handler(w http.ResponseWriter, r *http.Request) {
	app.ServeHTTP(w, r)
}