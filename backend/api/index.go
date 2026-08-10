package handler

import (
	"log"
	"net/http"

	"mypkk/admin"
	"mypkk/barang"
	"mypkk/database"
	"mypkk/redis"
	"mypkk/warga"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var app *gin.Engine

func init() {
	// 1. Load file .env jika ada (saat local dev)
	_ = godotenv.Load()

	// 2. Setup Router Gin
	gin.SetMode(gin.ReleaseMode)
	app = gin.New()
	app.Use(gin.Recovery())

	// 3. Setup CORS (Bisa menerima dari localhost dan Vercel frontend/backend)
	app.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			// Izinkan semua domain localhost & vercel
			return true
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// 4. Root & Health Check Endpoint (Mencegah crash jika root URL diakses)
	app.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "API PKK Management Serverless Running Perfectly!",
		})
	})

	app.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "OK"})
	})

	// 5. Inisialisasi Database dengan Penanganan Crash
	NewDB, err := database.OnDB()
	if err != nil || NewDB == nil {
		log.Printf("[ERROR] Gagal menginisialisasi database: %v", err)
		return
	}
	log.Println("[INFO] Database Serverless berhasil terhubung!")

	// 6. Inisialisasi Redis
	redis.ONRedis()

	// 7. Inisialisasi DB Handlers
	AdminDb := &admin.DB{
		Database: NewDB.Database,
	}

	BarangDb := &barang.DB{
		Database: NewDB.Database,
	}

	WargaDb := &warga.DB{
		Database: NewDB.Database,
	}

	// --- ROUTING ENDPOINT (Sama Persis dengan main.go) ---

	// admin pengumuman
	app.POST("/admin/add/dashboard", AdminDb.AddPengumuman())
	app.GET("/admin/pengumuman", AdminDb.CekPengumuman())
	app.DELETE("/admin/delet", AdminDb.DelPengumuman())
	app.POST("/pengumuman/refresh", AdminDb.RefreshP())

	// warga
	app.POST("/warga/add", WargaDb.AddWarga())
	app.PUT("/warga/update/:id", WargaDb.DelWarga())
	app.GET("/warga/data", WargaDb.GetWarga())
	app.POST("/warga/refresh", warga.RefreshW())
	app.PUT("/warga/restore/:id", WargaDb.RestoreWarga())
	app.DELETE("/warga/delete/:id", WargaDb.HardDelWarga())

	// admin barang
	app.POST("/admin/barang", BarangDb.AddBarang())
	app.GET("/admin/barang", BarangDb.GetBarang())
	app.DELETE("/admin/barang", BarangDb.DelBArang())
	app.POST("/barang/refresh", BarangDb.RefreshB())

	// admin peminjam
	app.DELETE("/barang/peminjaman", BarangDb.DelPinjaman())
	app.PUT("/barang/update", BarangDb.UpdateLoanStatus())
	app.GET("/barang/peminjam", BarangDb.GetPinjaman())

	// admin keuangan
	app.POST("/admin/amount", AdminDb.AddKeuangan())
	app.GET("/admin/data/amount", AdminDb.DataKeuangan())
	app.DELETE("/admin/data/amount", AdminDb.DelKeuangan())
	app.POST("/keuangan/refresh", AdminDb.RefreshK())

	// user pinjam
	app.POST("/user/pinjam", BarangDb.AddPinjam())
}

// Handler adalah Entry Point utama Vercel Serverless Function
func Handler(w http.ResponseWriter, r *http.Request) {
	app.ServeHTTP(w, r)
}