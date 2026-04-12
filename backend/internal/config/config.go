package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBUrl          string
	JWTSecret      string
	AESKey         string
	Port           string
	AllowedOrigins string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	cfg := &Config{
		DBUrl:          getEnv("DB_URL", "postgres://netwise:password@localhost:5432/netwise?sslmode=disable"),
		JWTSecret:      getEnv("JWT_SECRET", "change-me-in-production"),
		AESKey:         getEnv("AES_KEY", "0123456789abcdef0123456789abcdef"),
		Port:           getEnv("PORT", "8080"),
		AllowedOrigins: getEnv("ALLOWED_ORIGINS", "http://localhost:3000"),
	}

	if len(cfg.AESKey) != 32 {
		log.Fatal("AES_KEY must be exactly 32 characters")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
