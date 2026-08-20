package main

import (
	"log"
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

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Peringatan: File .env tidak ditemukan, mengandalkan environment system.")
	}
	NewDB, err := database.OnDB()
	if err != nil {
		log.Fatalf("Gagal menginisialisasi database: %v", err)
	}
	defer NewDB.Database.Close()
	log.Println("Database berhasil terhubung!")

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

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "https://pkk-manajemen.vercel.app"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// --- PUBLIC ROUTES ---
	r.POST("/api/login", AuthDb.Login())
	r.POST("/api/register", AuthDb.Register())

	// warga (Public)
	r.POST("/warga/add", WargaDb.AddWarga())
	r.PUT("/warga/update/:id", WargaDb.DelWarga())
	r.GET("/warga/data", WargaDb.GetWarga())
	r.POST("/warga/refresh", warga.RefreshW())
	r.PUT("/warga/restore/:id", WargaDb.RestoreWarga())
	r.DELETE("/warga/delete/:id", WargaDb.HardDelWarga())

	// user pinjam (Public)
	r.POST("/user/pinjam", BarangDb.AddPinjam())

	// --- PROTECTED ADMIN ROUTES ---
	adminGroup := r.Group("/admin")
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
	protectedGroup := r.Group("/")
	protectedGroup.Use(middleware.AuthMiddleware())
	{
		protectedGroup.POST("/pengumuman/refresh", AdminDb.RefreshP())
		protectedGroup.POST("/barang/refresh", BarangDb.RefreshB())
		protectedGroup.DELETE("/barang/peminjaman", BarangDb.DelPinjaman())
		protectedGroup.PUT("/barang/update", BarangDb.UpdateLoanStatus())
		protectedGroup.POST("/keuangan/refresh", AdminDb.RefreshK())
	}

	r.Run(":8080")
}