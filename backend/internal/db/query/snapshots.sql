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
WITH portfolio_daily AS (
    SELECT ps.snapshot_date,
           SUM(CASE WHEN ps.currency = 'IDR'
                    THEN (ps.total_equity + ps.cash_balance) * $4::NUMERIC
                    ELSE  (ps.total_equity + ps.cash_balance) * $5::NUMERIC END) AS portfolio_nw,
           SUM(CASE WHEN ps.currency = 'IDR'
                    THEN ps.total_invested * $4::NUMERIC
                    ELSE ps.total_invested * $5::NUMERIC END)                     AS total_invested,
           SUM(CASE WHEN ps.currency = 'IDR'
                    THEN ps.unrealized * $4::NUMERIC
                    ELSE ps.unrealized * $5::NUMERIC END)                         AS unrealized,
           SUM(CASE WHEN ps.currency = 'IDR'
                    THEN ps.realized * $4::NUMERIC
                    ELSE ps.realized * $5::NUMERIC END)                           AS realized,
           SUM(CASE WHEN ps.currency = 'IDR'
                    THEN ps.cash_balance * $4::NUMERIC
                    ELSE ps.cash_balance * $5::NUMERIC END)                       AS portfolio_cash
    FROM portfolio_snapshot ps
    JOIN portfolio p ON p.id = ps.portfolio_id
    WHERE p.user_id = $1
      AND ps.snapshot_date >= $2
      AND ps.snapshot_date <= $3
    GROUP BY ps.snapshot_date
),
wallet_daily AS (
    SELECT ws.snapshot_date,
           SUM(ws.balance_usd * $5::NUMERIC) AS wallet_usd
    FROM wallet_snapshot ws
    JOIN wallet w ON w.id = ws.wallet_id
    WHERE w.user_id = $1
      AND ws.snapshot_date >= $2
      AND ws.snapshot_date <= $3
    GROUP BY ws.snapshot_date
),
all_dates AS (
    SELECT snapshot_date FROM portfolio_daily
    UNION
    SELECT snapshot_date FROM wallet_daily
)
SELECT
    d.snapshot_date,
    (COALESCE(pd.portfolio_nw, 0)   + COALESCE(wd.wallet_usd, 0))::NUMERIC AS net_worth,
    COALESCE(pd.total_invested, 0)::NUMERIC                                  AS total_invested,
    COALESCE(pd.unrealized, 0)::NUMERIC                                      AS unrealized,
    COALESCE(pd.realized, 0)::NUMERIC                                        AS realized,
    (COALESCE(pd.portfolio_cash, 0) + COALESCE(wd.wallet_usd, 0))::NUMERIC  AS cash_balance
FROM all_dates d
LEFT JOIN portfolio_daily pd ON pd.snapshot_date = d.snapshot_date
LEFT JOIN wallet_daily    wd ON wd.snapshot_date = d.snapshot_date
ORDER BY d.snapshot_date ASC;

-- name: CountPortfolioSnapshotsForDate :one
SELECT COUNT(*) FROM portfolio_snapshot WHERE snapshot_date = $1;
