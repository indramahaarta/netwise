-- name: CreatePortfolioFee :one
INSERT INTO portfolio_fee (portfolio_id, amount, note, transaction_time)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListPortfolioFees :many
SELECT * FROM portfolio_fee
WHERE portfolio_id = $1
ORDER BY transaction_time DESC
LIMIT $2 OFFSET $3;
