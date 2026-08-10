package warga

import (
	"time"

	
)

// Warga mewakili struktur tabel public.warga di database
type Warga struct {
	ID        string `json:"id" db:"id"`
	Nama      string    `json:"nama" db:"nama"`
	RtRw      string    `json:"rt_rw" db:"rt_rw"`
	NoHp      *string   `json:"no_hp" db:"no_hp"` // Menggunakan pointer (*string) karena kolom no_hp bisa NULL
	IsAktif   bool      `json:"is_aktif" db:"is_aktif"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// CreateWargaRequest digunakan sebagai DTO saat menerima request INSERT warga baru
type CreateWargaRequest struct {
	Nama string  `json:"nama" binding:"required"`
	RtRw string  `json:"rt_rw"` // Opsional, jika kosong bisa di-set default 'RT 01/RW 01'
	NoHp *string `json:"no_hp"` // Opsional
}

// UpdateStatusWargaRequest digunakan untuk mengubah status is_aktif (misal: soft delete)
type UpdateStatusWargaRequest struct {
	IsAktif bool `json:"is_aktif"`
}
