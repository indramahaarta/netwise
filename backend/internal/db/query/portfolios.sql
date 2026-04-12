-- name: CreatePortfolio :one
INSERT INTO portfolio (user_id, name, currency, cash)
VALUES ($1, $2, $3, 0)
RETURNING *;

-- name: ListPortfoliosByUser :many
SELECT * FROM portfolio
WHERE user_id = $1
ORDER BY created_time ASC;

-- name: GetPortfolio :one
SELECT * FROM portfolio
WHERE id = $1;

-- name: GetPortfolioForUser :one
SELECT * FROM portfolio
WHERE id = $1 AND user_id = $2;

-- name: UpdatePortfolio :one
UPDATE portfolio
SET name         = COALESCE(sqlc.narg('name'), name),
    currency     = COALESCE(sqlc.narg('currency'), currency),
    updated_time = NOW()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: UpdatePortfolioCash :one
UPDATE portfolio
SET cash         = $2,
    updated_time = NOW()
WHERE id = $1
RETURNING *;

-- name: DeletePortfolio :exec
DELETE FROM portfolio
WHERE id = $1 AND user_id = $2;

-- name: ListAllPortfolios :many
SELECT * FROM portfolio ORDER BY id ASC;
