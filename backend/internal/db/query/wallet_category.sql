-- name: GetWalletCategory :one
SELECT * FROM wallet_category WHERE id = $1;

-- name: ListWalletCategories :many
SELECT * FROM wallet_category
WHERE (user_id = $1 OR user_id IS NULL)
ORDER BY is_system DESC, name ASC;

-- name: GetWalletCategoryByName :one
SELECT * FROM wallet_category
WHERE name = $1 AND (user_id IS NULL OR user_id = $2)
LIMIT 1;

-- name: CreateWalletCategory :one
INSERT INTO wallet_category (user_id, name, type, is_system)
VALUES ($1, $2, $3, FALSE)
RETURNING *;

-- name: DeleteWalletCategory :exec
DELETE FROM wallet_category WHERE id = $1 AND user_id = $2;
