package redis

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)


var Redis *redis.Client

func ONRedis (){
	url:= os.Getenv("REDIS_URL")
	if url ==""{
		return 
	}
	NewUrl, err:= redis.ParseURL(url)
	if err!=nil{
		return
	}
	c, cancel:= context.WithTimeout(context.Background(),5*time.Second)
	defer cancel()
	data := redis.NewClient(NewUrl)
	
	Redis = data
	_,err= Redis.Ping(c).Result()
	if err!=nil{
		log.Printf("[WARN] Gagal terhubung ke Redis: %v. Aplikasi tetap berjalan tanpa Redis.\n", err)
		Redis=nil
		return
	}
	fmt.Println("Berhasil terhubung ke Redis!")
}

func SetREDIS(nama string,isi interface{}, durasi time.Duration)error{
	if Redis == nil {
		return fmt.Errorf("redis tidak aktif")
	}
	c,cancel:= context.WithTimeout(context.Background(),5*time.Second)
	defer cancel()
	err := Redis.Set(c, nama,isi,durasi).Err()
	if err!=nil{
		return err
	}
	return  nil
}

func GetREDIS(nama string)(string,error){
	if Redis == nil {
		return "", fmt.Errorf("redis tidak aktif")
	}
	c,cancel:= context.WithTimeout(context.Background(),5*time.Second)
	defer cancel()
	data,err:= Redis.Get(c, nama).Result()
	if err!=nil{
		return "", err
	}

	return  data, nil
}

func DelRedis(nama string)error{
	if Redis == nil {
		return fmt.Errorf("redis tidak aktif")
	}
	c,cancel:= context.WithTimeout(context.Background(),5*time.Second)
	defer cancel()
	err:= Redis.Del(c,nama).Err()
	if err!=nil{
		return err
	}
	return  nil
}