package service

import (
	"context"
	"log"
	"time"

	"github.com/shopspring/decimal"

	"github.com/indramahaarta/netwise/internal/config"
	db "github.com/indramahaarta/netwise/internal/db/sqlc"
)

// RunDailySnapshot generates portfolio_snapshot, ticker_snapshot, and wallet_snapshot rows for today.
func RunDailySnapshot(ctx context.Context, queries *db.Queries, cfg *config.Config) error {
	today := time.Now().UTC().Truncate(24 * time.Hour).Add(-24 * time.Hour)

	portfolios, err := listAllPortfolios(ctx, queries)
	if err != nil {
		return err
	}
	for _, p := range portfolios {
		if err := snapshotPortfolio(ctx, queries, p, today); err != nil {
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
	// Use end-of-day boundary so transactions made during `today` are included.
	endOfDay := today.Add(24*time.Hour - time.Nanosecond)
	balance, err := queries.GetWalletBalanceAsOf(ctx, db.GetWalletBalanceAsOfParams{
		WalletID:        w.ID,
		TransactionTime: endOfDay,
	})
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

func snapshotPortfolio(ctx context.Context, queries *db.Queries, p db.Portfolio, today time.Time) error {
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
			// IDX stocks (.JK) and IDR crypto (-IDR) — already IDR-priced on Yahoo Finance
			if price, err := GetIDRPrice(h.Symbol); err == nil && price > 0 {
				livePrice = decimal.NewFromFloat(price)
			}
		} else {
			// US stocks and other Yahoo Finance symbols
			if price, err := yahooChartPrice(h.Symbol); err == nil && price > 0 {
				livePrice = decimal.NewFromFloat(price)
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
		if err := snapshotPortfolioForDate(ctx, queries, p, d); err != nil {
			log.Printf("historical snapshot error for portfolio %d: %v", p.ID, err)
		}
	}

	// Wallet snapshots use balance as of the snapshot date (transactions up to end of that day).
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

// NOTE: uses current holdings (ListHoldingsByPortfolio), not historical.
// This is acceptable for nightly snapshots (run at EOD with correct holdings).
// For historical backfill, quantities will be wrong if holdings changed after the target date.
// TODO: implement GetHoldingsAsOfDate from transaction history for accurate backfill.
func snapshotPortfolioForDate(ctx context.Context, queries *db.Queries, p db.Portfolio, date time.Time) error {
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

		// For historical snapshots, use historical prices (Yahoo Finance for all symbols).
		var livePrice decimal.Decimal
		if p, err := GetHistoricalClosePrice(h.Symbol, date); err == nil && p > 0 {
			livePrice = decimal.NewFromFloat(p)
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

// RecomputeWalletSnapshotsFrom recomputes wallet_snapshot rows for walletID
// from startDate through yesterday (UTC). Called after a backdated transaction
// is added, updated, or deleted so all affected snapshot rows stay accurate.
func RecomputeWalletSnapshotsFrom(ctx context.Context, queries *db.Queries, walletID int64, startDate time.Time) {
	yesterday := time.Now().UTC().Truncate(24 * time.Hour).Add(-24 * time.Hour)
	d := startDate.UTC().Truncate(24 * time.Hour)
	if d.After(yesterday) {
		return // today's or future transactions don't affect past snapshots
	}

	w, err := queries.GetWallet(ctx, walletID)
	if err != nil {
		log.Printf("recompute snapshots: wallet %d not found: %v", walletID, err)
		return
	}

	var idrToUsd float64 = 1
	if rate, err := GetFreeForexRate("IDR", "USD"); err == nil && rate > 0 {
		idrToUsd = rate
	}
	idrToUsdD := decimal.NewFromFloat(idrToUsd)

	for !d.After(yesterday) {
		if err := snapshotWallet(ctx, queries, w, idrToUsdD, d); err != nil {
			log.Printf("recompute wallet snapshot wallet %d date %s: %v", walletID, d.Format("2006-01-02"), err)
		}
		d = d.Add(24 * time.Hour)
	}
}
