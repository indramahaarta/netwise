-- name: CreateWallet :one
INSERT INTO wallet (user_id, name, currency)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetWallet :one
SELECT * FROM wallet WHERE id = $1;

-- name: GetWalletForUser :one
SELECT * FROM wallet WHERE id = $1 AND user_id = $2;

-- name: ListWalletsByUser :many
SELECT * FROM wallet WHERE user_id = $1 ORDER BY created_time ASC;

-- name: ListAllWallets :many
SELECT * FROM wallet ORDER BY id ASC;

-- name: UpdateWalletName :one
UPDATE wallet SET name = $2, updated_time = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteWallet :exec
DELETE FROM wallet WHERE id = $1 AND user_id = $2;
