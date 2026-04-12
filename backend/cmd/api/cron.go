package main

import (
	"context"
	"log"
	"time"

	"github.com/indramahaarta/netwise/internal/config"
	"github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/service"
)

func startSnapshotCron(queries *db.Queries, cfg *config.Config) {
	for {
		now := time.Now()
		// Next midnight UTC
		next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.UTC)
		wait := time.Until(next)
		log.Printf("Next snapshot in %v", wait)
		time.Sleep(wait)

		log.Println("Running daily portfolio snapshot...")
		if err := service.RunDailySnapshot(context.Background(), queries, cfg); err != nil {
			log.Printf("Snapshot error: %v", err)
		}
	}
}
