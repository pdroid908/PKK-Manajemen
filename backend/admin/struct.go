package admin

import "time"

type Pengumuman struct {
	ID          int      `json:"id"`
	Title       string   `json:"title"`
	EventDate   time.Time   `json:"event_date"` 
	EventTime   string   `json:"event_time"`
	Location    string   `json:"location"`
	Description string   `json:"description"`
	ImageName   *string  `json:"image_name"` 
	CreatedAt   time.Time `json:"created_at"`
}

type AddPengumumanRequest struct {
	Title       string  `json:"title"`
	EventDate   string  `json:"event_date"` 
	EventTime   string  `json:"event_time"`
	Location    string  `json:"location"`
	Description string  `json:"description"`
	ImageName   *string `json:"image_name"`
}

type DelPengumuman struct{
	ID int `json:"id" binding:"required"`
}

type FinanceTransaction struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	Title           string    `gorm:"size:255;not null" json:"title"` 
	Type            string    `gorm:"size:10;not null" json:"type"`   
	Amount          float64   `gorm:"type:decimal(15,2);not null" json:"amount"`
	BalanceAfter    float64   `gorm:"type:decimal(15,2);not null" json:"balance_after"`
	ProofImage      string    `gorm:"size:255" json:"proof_image"` 
	TransactionDate time.Time `gorm:"not null" json:"transaction_date"`
}

type AddFinanceRequest struct {
	Title      string  `json:"title" binding:"required"`
	Type       string  `json:"type" binding:"required"`   // "INCOME" atau "EXPENSE"
	Amount     float64 `json:"amount" binding:"required"` // Nominal transaksi
	ProofImage string  `json:"proof_image"`               // Path/URL foto nota (opsional)
}

type DelFinance struct {
	ID int `json:"id"`
}