package service

import (
	"context"
	"log"
	"time"

	"github.com/shopspring/decimal"

	"github.com/indramahaarta/netwise/internal/config"
	db "github.com/indramahaarta/netwise/internal/db/sqlc"
	"github.com/indramahaarta/netwise/internal/util"
)

// RunDailySnapshot generates portfolio_snapshot and ticker_snapshot rows for today.
func RunDailySnapshot(ctx context.Context, queries *db.Queries, cfg *config.Config) error {
	today := time.Now().UTC().Truncate(24 * time.Hour)

	// Iterate all users and their portfolios
	// We pull portfolios directly — no ListAllPortfolios query, so iterate per user.
	// This is a best-effort approach: get all portfolios with their user.
	// We'll add a ListAllPortfolios query here inline via raw approach.
	// For simplicity, we query all portfolios directly.

	portfolios, err := listAllPortfolios(ctx, queries)
	if err != nil {
		return err
	}

	for _, p := range portfolios {
		if err := snapshotPortfolio(ctx, queries, cfg, p, today); err != nil {
			log.Printf("snapshot error for portfolio %d: %v", p.ID, err)
		}
	}
	return nil
}

func snapshotPortfolio(ctx context.Context, queries *db.Queries, cfg *config.Config, p db.Portfolio, today time.Time) error {
	user, err := queries.GetUserByID(ctx, p.UserID)
	if err != nil {
		return err
	}

	var finnhubKey string
	if user.FinnhubApiKey.Valid {
		finnhubKey, _ = util.DecryptAES(user.FinnhubApiKey.String, cfg.AESKey)
	}

	holdings, err := queries.ListHoldingsByPortfolio(ctx, p.ID)
	if err != nil {
		return err
	}

	totalEquity := decimal.Zero
	totalInvested := decimal.Zero

	for _, h := range holdings {
		shares := decimalFromString(h.Share)
		avg := decimalFromString(h.Avg)
		invested := shares.Mul(avg)
		totalInvested = totalInvested.Add(invested)

		var livePrice decimal.Decimal
		if finnhubKey != "" {
			fc := NewFinnhubClient(finnhubKey)
			if q, err := fc.Quote(h.Symbol); err == nil && q.C > 0 {
				livePrice = decimal.NewFromFloat(q.C)
			}
		}
		if livePrice.IsZero() {
			livePrice = avg
		}

		marketValue := shares.Mul(livePrice)
		totalEquity = totalEquity.Add(marketValue)

		// Upsert ticker snapshot
		if _, err := queries.UpsertTickerSnapshot(ctx, db.UpsertTickerSnapshotParams{
			PortfolioID:  p.ID,
			TickerID:     h.TickerID,
			Price:        livePrice.StringFixed(8),
			Currency:     h.TickerCurrency,
			Quantity:     h.Share,
			Avg:          h.Avg,
			MarketValue:  marketValue.StringFixed(8),
			SnapshotDate: today,
		}); err != nil {
			log.Printf("ticker snapshot error: %v", err)
		}
	}

	realized, _ := queries.SumRealizedGainByPortfolio(ctx, p.ID)
	cash := decimalFromString(p.Cash)
	unrealized := totalEquity.Sub(totalInvested)

	if _, err := queries.UpsertPortfolioSnapshot(ctx, db.UpsertPortfolioSnapshotParams{
		PortfolioID:   p.ID,
		TotalEquity:   totalEquity.StringFixed(8),
		TotalInvested: totalInvested.StringFixed(8),
		CashBalance:   cash.StringFixed(8),
		Unrealized:    unrealized.StringFixed(8),
		Realized:      realized,
		Currency:      p.Currency,
		SnapshotDate:  today,
	}); err != nil {
		return err
	}

	return nil
}

func listAllPortfolios(ctx context.Context, queries *db.Queries) ([]db.Portfolio, error) {
	return queries.ListAllPortfolios(ctx)
}

func decimalFromString(s string) decimal.Decimal {
	d, _ := decimal.NewFromString(s)
	return d
}
