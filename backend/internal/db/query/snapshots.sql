-- name: UpsertPortfolioSnapshot :one
INSERT INTO portfolio_snapshot (portfolio_id, total_equity, total_invested, cash_balance, unrealized, realized, currency, snapshot_date)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (portfolio_id, snapshot_date) DO UPDATE
    SET total_equity   = EXCLUDED.total_equity,
        total_invested = EXCLUDED.total_invested,
        cash_balance   = EXCLUDED.cash_balance,
        unrealized     = EXCLUDED.unrealized,
        realized       = EXCLUDED.realized,
        currency       = EXCLUDED.currency
RETURNING *;

-- name: ListPortfolioSnapshots :many
SELECT * FROM portfolio_snapshot
WHERE portfolio_id = $1
  AND snapshot_date >= $2
  AND snapshot_date <= $3
ORDER BY snapshot_date ASC;

-- name: UpsertTickerSnapshot :one
INSERT INTO ticker_snapshot (portfolio_id, ticker_id, price, currency, quantity, avg, market_value, snapshot_date)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (portfolio_id, ticker_id, snapshot_date) DO UPDATE
    SET price        = EXCLUDED.price,
        currency     = EXCLUDED.currency,
        quantity     = EXCLUDED.quantity,
        avg          = EXCLUDED.avg,
        market_value = EXCLUDED.market_value
RETURNING *;

-- name: ListNetWorthSnapshots :many
SELECT
    ps.snapshot_date,
    COALESCE(SUM(ps.total_equity + ps.cash_balance), 0)::NUMERIC AS net_worth,
    COALESCE(SUM(ps.total_invested), 0)::NUMERIC                 AS total_invested,
    COALESCE(SUM(ps.unrealized), 0)::NUMERIC                     AS unrealized,
    COALESCE(SUM(ps.realized), 0)::NUMERIC                       AS realized,
    COALESCE(SUM(ps.cash_balance), 0)::NUMERIC                   AS cash_balance
FROM portfolio_snapshot ps
JOIN portfolio p ON p.id = ps.portfolio_id
WHERE p.user_id = $1
  AND ps.snapshot_date >= $2
  AND ps.snapshot_date <= $3
GROUP BY ps.snapshot_date
ORDER BY ps.snapshot_date ASC;
