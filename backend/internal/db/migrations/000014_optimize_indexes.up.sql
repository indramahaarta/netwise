-- Drop redundant explicit indexes superseded by their UNIQUE constraints
DROP INDEX IF EXISTS idx_holding_portfolio_id;
DROP INDEX IF EXISTS idx_portfolio_snapshot_portfolio_date;
DROP INDEX IF EXISTS idx_ticker_snapshot_portfolio_ticker_date;
DROP INDEX IF EXISTS idx_wallet_snapshot_date;

-- dividend: cover ORDER BY transaction_time DESC in ListDividends
CREATE INDEX IF NOT EXISTS idx_dividend_portfolio_time
    ON dividend(portfolio_id, transaction_time DESC);

-- portfolio_fee: cover ORDER BY transaction_time DESC in ListPortfolioFees
CREATE INDEX IF NOT EXISTS idx_portfolio_fee_portfolio_time
    ON portfolio_fee(portfolio_id, transaction_time DESC);

-- portfolio_snapshot: cover CountPortfolioSnapshotsForDate (startup cron check)
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshot_date
    ON portfolio_snapshot(snapshot_date);

-- wallet_category: cover GetWalletCategoryByName (name lookup with optional user filter)
CREATE INDEX IF NOT EXISTS idx_wallet_category_name_user
    ON wallet_category(name, user_id);
