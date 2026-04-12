-- name: CreateCashFlow :one
INSERT INTO cash_flow (portfolio_id, type, source_amount, source_currency, target_amount, target_currency, broker_rate, transaction_time)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListCashFlows :many
SELECT * FROM cash_flow
WHERE portfolio_id = $1
  AND ($2::TIMESTAMPTZ = '0001-01-01'::TIMESTAMPTZ OR transaction_time >= $2)
  AND ($3::TIMESTAMPTZ = '0001-01-01'::TIMESTAMPTZ OR transaction_time <= $3)
ORDER BY transaction_time DESC
LIMIT $4 OFFSET $5;
