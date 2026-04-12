-- name: GetOrCreateTicker :one
INSERT INTO ticker (symbol, name, type, currency, sector, subsector)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (symbol) DO UPDATE
    SET name         = EXCLUDED.name,
        type         = EXCLUDED.type,
        currency     = EXCLUDED.currency,
        sector       = EXCLUDED.sector,
        subsector    = EXCLUDED.subsector,
        updated_time = NOW()
RETURNING *;

-- name: GetTickerBySymbol :one
SELECT * FROM ticker
WHERE symbol = $1;

-- name: GetTickerByID :one
SELECT * FROM ticker
WHERE id = $1;
