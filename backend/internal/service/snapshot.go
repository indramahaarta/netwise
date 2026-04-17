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

// RunDailySnapshot generates portfolio_snapshot, ticker_snapshot, and wallet_snapshot rows for today.
func RunDailySnapshot(ctx context.Context, queries *db.Queries, cfg *config.Config) error {
	today := time.Now().UTC().Truncate(24 * time.Hour)

	portfolios, err := listAllPortfolios(ctx, queries)
	if err != nil {
		return err
	}
	for _, p := range portfolios {
		if err := snapshotPortfolio(ctx, queries, cfg, p, today); err != nil {
			log.Printf("snapshot error for portfolio %d: %v", p.ID, err)
		}
	}

	// Snapshot wallets — fetch IDR→USD rate once for all wallets
	var idrToUsd float64 = 1
	if rate, err := GetFreeForexRate("IDR", "USD"); err == nil && rate > 0 {
		idrToUsd = rate
	}
	idrToUsdD := decimal.NewFromFloat(idrToUsd)

	wallets, err := queries.ListAllWallets(ctx)
	if err != nil {
		log.Printf("wallet snapshot: failed to list wallets: %v", err)
		return nil
	}
	for _, w := range wallets {
		if err := snapshotWallet(ctx, queries, w, idrToUsdD, today); err != nil {
			log.Printf("wallet snapshot error for wallet %d: %v", w.ID, err)
		}
	}

	return nil
}

func snapshotWallet(ctx context.Context, queries *db.Queries, w db.Wallet, idrToUsd decimal.Decimal, today time.Time) error {
	balance, err := queries.GetWalletBalance(ctx, w.ID)
	if err != nil {
		return err
	}
	bal := decimalFromString(balance)
	balUSD := bal.Mul(idrToUsd)

	_, err = queries.UpsertWalletSnapshot(ctx, db.UpsertWalletSnapshotParams{
		WalletID:     w.ID,
		Balance:      bal.StringFixed(8),
		BalanceUsd:   balUSD.StringFixed(8),
		SnapshotDate: today,
	})
	return err
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
		if IsIDRNativeSymbol(h.Symbol) {
			// IDX stocks (.JK) and IDR crypto (-IDR) → Yahoo Finance (no API key needed)
			if p, err := GetIDRPrice(h.Symbol); err == nil && p > 0 {
				livePrice = decimal.NewFromFloat(p)
			}
		} else if finnhubKey != "" {
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

// RunSnapshotForDate generates snapshots for a specific historical date using
// historical prices from Yahoo Finance. Useful for backfilling gaps.
func RunSnapshotForDate(ctx context.Context, queries *db.Queries, cfg *config.Config, date time.Time) error {
	d := date.UTC().Truncate(24 * time.Hour)
	log.Printf("Running historical snapshot for %s...", d.Format("2006-01-02"))

	portfolios, err := listAllPortfolios(ctx, queries)
	if err != nil {
		return err
	}
	for _, p := range portfolios {
		if err := snapshotPortfolioForDate(ctx, queries, cfg, p, d); err != nil {
			log.Printf("historical snapshot error for portfolio %d: %v", p.ID, err)
		}
	}

	// Wallet snapshots use current balance (wallets don't have historical pricing)
	var idrToUsd float64 = 1
	if rate, err := GetFreeForexRate("IDR", "USD"); err == nil && rate > 0 {
		idrToUsd = rate
	}
	idrToUsdD := decimal.NewFromFloat(idrToUsd)

	wallets, err := queries.ListAllWallets(ctx)
	if err != nil {
		log.Printf("wallet snapshot: failed to list wallets: %v", err)
		return nil
	}
	for _, w := range wallets {
		if err := snapshotWallet(ctx, queries, w, idrToUsdD, d); err != nil {
			log.Printf("wallet snapshot error for wallet %d: %v", w.ID, err)
		}
	}

	return nil
}

func snapshotPortfolioForDate(ctx context.Context, queries *db.Queries, cfg *config.Config, p db.Portfolio, date time.Time) error {
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

		// For historical snapshots, use historical prices (Yahoo Finance)
		var livePrice decimal.Decimal
		if IsIDRNativeSymbol(h.Symbol) {
			// IDX stocks (.JK) and IDR crypto (-IDR) → Yahoo Finance historical
			if p, err := GetHistoricalClosePrice(h.Symbol, date); err == nil && p > 0 {
				livePrice = decimal.NewFromFloat(p)
			}
		} else {
			// US stocks → Yahoo Finance historical (works for all symbols)
			if p, err := GetHistoricalClosePrice(h.Symbol, date); err == nil && p > 0 {
				livePrice = decimal.NewFromFloat(p)
			}
		}
		if livePrice.IsZero() {
			// Fallback: use average cost if historical price unavailable
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
			SnapshotDate: date,
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
		SnapshotDate:  date,
	}); err != nil {
		return err
	}

	return nil
}

func decimalFromString(s string) decimal.Decimal {
	d, _ := decimal.NewFromString(s)
	return d
}
