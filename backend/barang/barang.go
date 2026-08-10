package barang

import "time"

type InventoryItem struct {
	ID            int       `json:"id"`
	Name          string    `json:"name"`
	TotalQuantity int       `json:"total_quantity"`
	Description   string    `json:"description"`
	CreatedAt     time.Time `json:"created_at"`
	Image *string `json:"image"`
}

type AddInventoryRequest struct {
	Name          string `json:"name" binding:"required"`
	TotalQuantity int    `json:"total_quantity" binding:"required"`
	Description   string `json:"description"`
}

type DelInventory struct{
	ID int `json:"id"`
}

// user pinjam

type AddLoanRequest struct {
	ItemID               int       `json:"item_id" binding:"required"`
	BorrowerName         string    `json:"borrower_name" binding:"required"`
	QuantityBorrowed     int       `json:"quantity_borrowed" binding:"required"`
	EventName            string    `json:"event_name"`
	PlannedBorrowDate    time.Time `json:"planned_borrow_date"`
	PlannedReturnDate    time.Time `json:"planned_return_date"`
}

type UpdateLoanStatusRequest struct {
	ID     int    `json:"id" binding:"required"`
	Status string `json:"status" binding:"required"` // APPROVED, REJECTED, RETURNED
}

type LoanResponse struct {
	ID                int        `json:"id"`
	ItemID            int        `json:"item_id"`
	ItemName          string     `json:"item_name"`
	BorrowerName      string     `json:"borrower_name"`
	QuantityBorrowed  int        `json:"quantity_borrowed"`
	EventName         *string    `json:"event_name"`
	PlannedBorrowDate *time.Time `json:"planned_borrow_date"`
	PlannedReturnDate *time.Time `json:"planned_return_date"`
	Status            string     `json:"status"`
	BorrowDate        time.Time  `json:"borrow_date"`
	ReturnDate        *time.Time `json:"return_date"`
}

type DelLoanRequest struct {
	ID int `json:"id"`
}