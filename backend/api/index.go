package api
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
	// 1. Load .env jika ada
	_ = godotenv.Load()

	// 2. Inisialisasi Database
	NewDB, err := database.OnDB()
	if err != nil {
		log.Printf("Gagal menginisialisasi database: %v", err)
	} else {
		log.Println("Database Serverless berhasil terhubung!")
	}

	// 3. Inisialisasi Redis
	redis.ONRedis()

	// 4. Inisialisasi Struct Handler
	AdminDb := &admin.DB{
		Database: NewDB.Database,
	}

	BarangDb := &barang.DB{
		Database: NewDB.Database,
	}

	WargaDb := &warga.DB{
		Database: NewDB.Database,
	}

	// 5. Setup Router Gin
	gin.SetMode(gin.ReleaseMode)
	app = gin.New()
	app.Use(gin.Recovery())

	// Setup CORS
	app.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "https://pkk-manajemen.vercel.app"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// --- ROUTING ENDPOINT ---
	
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

// Handler adalah Entry Point utama yang dipanggil Vercel setiap kali ada request HTTP
func Handler(w http.ResponseWriter, r *http.Request) {
	app.ServeHTTP(w, r)
}