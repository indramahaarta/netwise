-- name: UpsertHolding :one
INSERT INTO holding (portfolio_id, ticker_id, avg, share)
VALUES ($1, $2, $3, $4)
ON CONFLICT (portfolio_id, ticker_id) DO UPDATE
    SET avg          = $3,
        share        = $4,
        updated_time = NOW()
RETURNING *;

-- name: GetHolding :one
SELECT * FROM holding
WHERE portfolio_id = $1 AND ticker_id = $2;

-- name: ListHoldingsByPortfolio :many
SELECT h.*, t.symbol, t.name AS ticker_name, t.currency AS ticker_currency
FROM holding h
JOIN ticker t ON t.id = h.ticker_id
WHERE h.portfolio_id = $1
ORDER BY h.created_time ASC;

-- name: DeleteHolding :exec
DELETE FROM holding
WHERE portfolio_id = $1 AND ticker_id = $2;
