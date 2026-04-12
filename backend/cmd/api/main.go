package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	"github.com/indramahaarta/netwise/internal/config"
	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/handler"
	"github.com/indramahaarta/netwise/internal/middleware"
)

func main() {
	cfg := config.Load()

	// Connect to database using pgxpool
	pool, err := pgxpool.New(context.Background(), cfg.DBUrl)
	if err != nil {
		log.Fatalf("unable to connect to database: %v", err)
	}
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}
	log.Println("Connected to database")

	// Run migrations
	runMigrations(cfg.DBUrl)

	// Wrap pgxpool as database/sql for sqlc
	sqlDB := stdlib.OpenDBFromPool(pool)
	queries := db.New(sqlDB)

	// Set up Gin
	r := gin.Default()
	r.Use(corsMiddleware(cfg.AllowedOrigins))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Register routes
	v1 := r.Group("/api/v1")
	handler.RegisterRoutes(v1, queries, cfg)

	authRequired := v1.Group("")
	authRequired.Use(middleware.Auth(cfg.JWTSecret))
	handler.RegisterProtectedRoutes(authRequired, queries, cfg)

	// Start cron snapshot
	go startSnapshotCron(queries, cfg)

	log.Printf("Server starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func runMigrations(dbURL string) {
	m, err := migrate.New("file://internal/db/migrations", dbURL)
	if err != nil {
		log.Fatalf("failed to create migrate instance: %v", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("migration failed: %v", err)
	}
	log.Println("Migrations applied")
}

func corsMiddleware(allowedOrigins string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", allowedOrigins)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH")
		c.Header("Access-Control-Allow-Headers", "Content-Type,Authorization")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
