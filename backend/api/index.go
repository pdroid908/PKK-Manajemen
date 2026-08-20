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

	// --- PUBLIC ROUTES ---
	app.POST("/api/login", AuthDb.Login())
	app.POST("/api/register", AuthDb.Register())

	// warga (Public)
	app.POST("/warga/add", WargaDb.AddWarga())
	app.PUT("/warga/update/:id", WargaDb.DelWarga())
	app.GET("/warga/data", WargaDb.GetWarga())
	app.POST("/warga/refresh", warga.RefreshW())
	app.PUT("/warga/restore/:id", WargaDb.RestoreWarga())
	app.DELETE("/warga/delete/:id", WargaDb.HardDelWarga())

	// user pinjam (Public)
	app.POST("/user/pinjam", BarangDb.AddPinjam())

	// --- PROTECTED ADMIN ROUTES ---
	adminGroup := app.Group("/admin")
	adminGroup.Use(middleware.AuthMiddleware())
	{
		// admin pengumuman
		adminGroup.POST("/add/dashboard", AdminDb.AddPengumuman())
		adminGroup.GET("/pengumuman", AdminDb.CekPengumuman())
		adminGroup.DELETE("/delet", AdminDb.DelPengumuman())

		// admin barang
		adminGroup.POST("/barang", BarangDb.AddBarang())
		adminGroup.GET("/barang", BarangDb.GetBarang())
		adminGroup.DELETE("/barang", BarangDb.DelBArang())

		// admin peminjam
		adminGroup.GET("/peminjam", BarangDb.GetPinjaman())

		// admin keuangan
		adminGroup.POST("/amount", AdminDb.AddKeuangan())
		adminGroup.GET("/data/amount", AdminDb.DataKeuangan())
		adminGroup.DELETE("/data/amount", AdminDb.DelKeuangan())
	}

	// --- PROTECTED UTILITY / REFRESH ROUTES ---
	protectedGroup := app.Group("/")
	protectedGroup.Use(middleware.AuthMiddleware())
	{
		protectedGroup.POST("/pengumuman/refresh", AdminDb.RefreshP())
		protectedGroup.POST("/barang/refresh", BarangDb.RefreshB())
		protectedGroup.DELETE("/barang/peminjaman", BarangDb.DelPinjaman())
		protectedGroup.PUT("/barang/update", BarangDb.UpdateLoanStatus())
		protectedGroup.POST("/keuangan/refresh", AdminDb.RefreshK())
	}
}

func Handler(w http.ResponseWriter, r *http.Request) {
	app.ServeHTTP(w, r)
}