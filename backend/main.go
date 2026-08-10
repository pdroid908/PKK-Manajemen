package main

import (
	"log"
	"mypkk/admin"
	"mypkk/barang"
	"mypkk/database"
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

	BarangDb:= &barang.DB{
		Database: NewDB.Database,
	}

	WargaDb:= &warga.DB{
		Database: NewDB.Database,
	}

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"}, // Sesuaikan port frontendmu
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))
	//admin pengumuman
	r.POST("/admin/add/dashboard", AdminDb.AddPengumuman())
	r.GET("/admin/pengumuman", AdminDb.CekPengumuman())
	r.DELETE("/admin/delet", AdminDb.DelPengumuman())
	r.POST("/pengumuman/refresh", AdminDb.RefreshP())

	//warga
	r.POST("/warga/add", WargaDb.AddWarga())
	r.PUT("/warga/update/:id",WargaDb.DelWarga())
	r.GET("/warga/data", WargaDb.GetWarga())
	r.POST("warga/refresh",warga.RefreshW())
	r.PUT("/warga/restore/:id", WargaDb.RestoreWarga()) // Aktifkan Kembali
	r.DELETE("/warga/delete/:id", WargaDb.HardDelWarga())

	//admin  barang
	r.POST("/admin/barang", BarangDb.AddBarang())
	r.GET("/admin/barang", BarangDb.GetBarang())
	r.DELETE("/admin/barang", BarangDb.DelBArang())
	r.POST("/barang/refresh", BarangDb.RefreshB())
	
	//admin peminjam
	r.DELETE("/barang/peminjaman", BarangDb.DelPinjaman())
	r.PUT("/barang/update", BarangDb.UpdateLoanStatus())
	r.GET("/barang/peminjam", BarangDb.GetPinjaman())
	
	//admin keuangan
	r.POST("/admin/amount", AdminDb.AddKeuangan())
	r.GET("/admin/data/amount", AdminDb.DataKeuangan())
	r.DELETE("/admin/data/amount", AdminDb.DelKeuangan())
	r.POST("/keuangan/refresh" ,AdminDb.RefreshK())

	// user pinjam
	r.POST("/user/pinjam", BarangDb.AddPinjam())



	r.Run(":8080")

}
