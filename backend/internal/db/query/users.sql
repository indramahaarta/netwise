-- name: CreateUser :one
INSERT INTO "user" (username, email, password, finnhub_api_key)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM "user"
WHERE email = $1;

-- name: GetUserByID :one
SELECT * FROM "user"
WHERE id = $1;

-- name: UpdateUser :one
UPDATE "user"
SET username        = COALESCE(sqlc.narg('username'), username),
    email           = COALESCE(sqlc.narg('email'), email),
    finnhub_api_key = COALESCE(sqlc.narg('finnhub_api_key'), finnhub_api_key),
    updated_time    = NOW()
WHERE id = $1
RETURNING *;
