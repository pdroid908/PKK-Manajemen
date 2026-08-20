package database

import (
	"context"
	"errors"
	"math/rand"
	"net"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type RetryConfig struct {
	MaxAttempts int
	BaseDelay   time.Duration
	MaxDelay    time.Duration
}

func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts: 3,
		BaseDelay:   100 * time.Millisecond,
		MaxDelay:    2 * time.Second,
	}
}

// RetryDB menjalankan perintah database dengan mekanisme penanganan retry otomatis.
func RetryDB(ctx context.Context, cfg RetryConfig, fn func(context.Context) error) error {
	cfg = normalizeRetryConfig(cfg)

	var err error
	for attempt := 1; attempt <= cfg.MaxAttempts; attempt++ {
		// Stop jika request HTTP dari user dibatalkan
		if err = ctx.Err(); err != nil {
			return err
		}

		// Eksekusi fungsi DB
		err = fn(ctx)
		if err == nil {
			return nil // Sukses
		}

		// Jika error permanen atau sudah percobaan terakhir, batalkan retry
		if !isRetryableDBError(err) || attempt == cfg.MaxAttempts {
			return err
		}

		// Tunggu sesuai rentang waktu backoff + jitter
		delay := calculateRetryDelay(attempt, cfg.BaseDelay, cfg.MaxDelay)
		timer := time.NewTimer(delay)

		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}

	return err
}

// isRetryableDBError memfilter mana error sementara yang layak di-retry
func isRetryableDBError(err error) bool {
	if err == nil {
		return false
	}

	// 1. Abaikan error yang bersifat final / pembatalan intentional
	if errors.Is(err, context.Canceled) ||
		errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, pgx.ErrNoRows) ||
		errors.Is(err, pgx.ErrTxClosed) {
		return false
	}

	// 2. Cek kode error PostgreSQL (Deadlock, Lock Timeout, Connection Error)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "40001", "40P01", "08000", "08003", "08006", "57P01", "57P02", "57P03":
			return true
		default:
			return false
		}
	}

	// 3. Cek Error Network (Network Timeout)
	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout()
	}

	// 4. Cek Pesan Error Terputusnya Koneksi
	errStr := strings.ToLower(err.Error())
	for _, message := range []string{
		"conn closed",
		"connection reset by peer",
		"broken pipe",
		"connection refused",
		"failed to acquire connection",
		"unexpected eof",
	} {
		if strings.Contains(errStr, message) {
			return true
		}
	}

	return false
}

// calculateRetryDelay menghitung jeda waktu menggunakan Exponential Backoff + Jitter
func calculateRetryDelay(attempt int, baseDelay, maxDelay time.Duration) time.Duration {
	delay := baseDelay
	for i := 1; i < attempt && delay < maxDelay; i++ {
		if delay > maxDelay/2 {
			delay = maxDelay
			break
		}
		delay *= 2
	}

	if delay > maxDelay {
		delay = maxDelay
	}

	if delay <= baseDelay {
		return baseDelay
	}

	// Full Jitter acak berbasis rand.Int63n
	delta := int64(delay - baseDelay)
	jitter := rand.Int63n(delta)

	return baseDelay + time.Duration(jitter)
}

func normalizeRetryConfig(cfg RetryConfig) RetryConfig {
	def := DefaultRetryConfig()

	if cfg.MaxAttempts < 1 {
		cfg.MaxAttempts = def.MaxAttempts
	}
	if cfg.BaseDelay <= 0 {
		cfg.BaseDelay = def.BaseDelay
	}
	if cfg.MaxDelay <= 0 {
		cfg.MaxDelay = def.MaxDelay
	}
	if cfg.MaxDelay < cfg.BaseDelay {
		cfg.MaxDelay = cfg.BaseDelay
	}

	return cfg
}