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
	// Catch-up: only if yesterday has no snapshot yet.
	// Prevents overwriting historical snapshots with wrong quantities
	// (snapshotPortfolioForDate uses current holdings, not historical).
	yesterday := time.Now().UTC().Truncate(24 * time.Hour).Add(-24 * time.Hour)
	log.Println("Running startup snapshot catch-up (yesterday)...")
	count, err := queries.CountPortfolioSnapshotsForDate(context.Background(), yesterday)
	if err != nil || count == 0 {
		if err := service.RunSnapshotForDate(context.Background(), queries, cfg, yesterday); err != nil {
			log.Printf("Startup snapshot error: %v", err)
		}
	} else {
		log.Printf("Snapshot for %s already exists (%d rows), skipping catch-up.", yesterday.Format("2006-01-02"), count)
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
