-- name: CreateTransaction :one
INSERT INTO transaction (portfolio_id, ticker_id, side, quantity, price, realized_gain, fee, total_amount, transaction_time)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListTransactions :many
SELECT t.*, tk.symbol, tk.name AS ticker_name
FROM transaction t
JOIN ticker tk ON tk.id = t.ticker_id
WHERE t.portfolio_id = $1
  AND ($2 = '' OR tk.symbol = $2)
  AND ($3 = '' OR t.side = $3)
  AND ($4::TIMESTAMPTZ = '0001-01-01'::TIMESTAMPTZ OR t.transaction_time >= $4)
  AND ($5::TIMESTAMPTZ = '0001-01-01'::TIMESTAMPTZ OR t.transaction_time <= $5)
ORDER BY t.transaction_time DESC
LIMIT $6 OFFSET $7;

-- name: GetTransaction :one
SELECT t.*, tk.symbol, tk.name AS ticker_name
FROM transaction t
JOIN ticker tk ON tk.id = t.ticker_id
WHERE t.id = $1 AND t.portfolio_id = $2;

-- name: SumRealizedGainByPortfolio :one
SELECT (
    COALESCE((SELECT SUM(t.realized_gain) FROM transaction t WHERE t.portfolio_id = $1 AND t.side = 'SELL'), 0)
    + COALESCE((SELECT SUM(d.amount) FROM dividend d WHERE d.portfolio_id = $1), 0)
    - COALESCE((SELECT SUM(f.amount) FROM portfolio_fee f WHERE f.portfolio_id = $1), 0)
)::NUMERIC AS total_realized_gain;

-- name: SumFeesByPortfolio :one
SELECT COALESCE(SUM(fee), 0)::NUMERIC AS total_fees
FROM transaction
WHERE portfolio_id = $1;
