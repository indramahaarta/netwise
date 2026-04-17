package main

import (
	"context"
	"log"
	"time"

	"github.com/indramahaarta/netwise/internal/config"
	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/service"
)

func startSnapshotCron(queries *db.Queries, cfg *config.Config) {
	// Backfill historical snapshots for missing dates (e.g., April 14-15 from outage)
	// This is idempotent (UPSERT), so safe to run repeatedly.
	log.Println("Checking for missing historical snapshots...")
	backfillDates := []time.Time{
		time.Date(2026, 4, 14, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 4, 15, 0, 0, 0, 0, time.UTC),
	}
	yesterday := time.Now().UTC().Truncate(24 * time.Hour).Add(-24 * time.Hour)
	for _, d := range backfillDates {
		if d.Before(yesterday) || d.Equal(yesterday) {
			log.Printf("Backfilling snapshot for %s...", d.Format("2006-01-02"))
			if err := service.RunSnapshotForDate(context.Background(), queries, cfg, d); err != nil {
				log.Printf("Backfill error for %s: %v", d.Format("2006-01-02"), err)
			}
		}
	}

	// Catch-up: run a snapshot immediately on startup so today is never missing.
	log.Println("Running startup snapshot catch-up...")
	if err := service.RunDailySnapshot(context.Background(), queries, cfg); err != nil {
		log.Printf("Startup snapshot error: %v", err)
	}

	for {
		runSnapshotCycle(queries, cfg)
	}
}

// runSnapshotCycle waits until the next midnight UTC then runs the snapshot.
// A deferred recover() ensures a panic cannot kill the goroutine permanently —
// the outer loop in startSnapshotCron will restart the cycle on the next day.
func runSnapshotCycle(queries *db.Queries, cfg *config.Config) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("snapshot cron panic (will retry next cycle): %v", r)
		}
	}()

	now := time.Now().UTC()
	next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.UTC)
	wait := time.Until(next)
	log.Printf("Next snapshot in %v", wait)
	time.Sleep(wait)

	log.Println("Running daily portfolio snapshot...")
	if err := service.RunDailySnapshot(context.Background(), queries, cfg); err != nil {
		log.Printf("Snapshot error: %v", err)
	}
}
