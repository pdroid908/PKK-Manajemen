package database

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct{
	Database *pgxpool.Pool
}

func OnDB() (*DB, error){
	dbUrl:= os.Getenv("DB_URL")
	if dbUrl ==""{
		return nil, fmt.Errorf("env di databaseGo kosong")
	}

	ctx,cancel:= context.WithTimeout(context.Background(),5*time.Second)
	defer cancel()

	config,err:= pgxpool.ParseConfig(dbUrl)
	if err!=nil{
		return nil, fmt.Errorf("gagal buat config database %v",err)
	}

	pool,err:= pgxpool.NewWithConfig(ctx,config)
	if err!=nil{
		return nil, fmt.Errorf("gagal buar pool database")
	}
	err= pool.Ping(ctx)
	if err!=nil{
		pool.Close()
		return nil, fmt.Errorf("gagal ping pool database")
	}

	return &DB{Database:pool}, nil
}