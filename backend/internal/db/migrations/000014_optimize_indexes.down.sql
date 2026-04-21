-- Restore the redundant indexes (down migration)
CREATE INDEX IF NOT EXISTS idx_holding_portfolio_id
    ON holding(portfolio_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshot_portfolio_date
    ON portfolio_snapshot(portfolio_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_ticker_snapshot_portfolio_ticker_date
    ON ticker_snapshot(portfolio_id, ticker_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_wallet_snapshot_date
    ON wallet_snapshot(wallet_id, snapshot_date);

-- Remove the new optimization indexes
DROP INDEX IF EXISTS idx_dividend_portfolio_time;
DROP INDEX IF EXISTS idx_portfolio_fee_portfolio_time;
DROP INDEX IF EXISTS idx_portfolio_snapshot_date;
DROP INDEX IF EXISTS idx_wallet_category_name_user;
