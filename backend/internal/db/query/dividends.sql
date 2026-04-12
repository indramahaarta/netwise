-- name: CreateDividend :one
INSERT INTO dividend (portfolio_id, ticker_id, currency, amount, transaction_time)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListDividends :many
SELECT d.*, t.symbol, t.name AS ticker_name
FROM dividend d
JOIN ticker t ON t.id = d.ticker_id
WHERE d.portfolio_id = $1
ORDER BY d.transaction_time DESC
LIMIT $2 OFFSET $3;

-- name: SumDividendsByPortfolio :one
SELECT COALESCE(SUM(amount), 0)::NUMERIC AS total_dividends
FROM dividend
WHERE portfolio_id = $1;
