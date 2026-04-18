-- name: CreateWalletTransaction :one
INSERT INTO wallet_transaction (
    wallet_id, type, amount, category_id,
    related_wallet_id, related_portfolio_id, broker_rate, note, transaction_time
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListWalletTransactions :many
SELECT
    wt.*,
    wc.name AS category_name,
    w2.name AS related_wallet_name
FROM wallet_transaction wt
LEFT JOIN wallet_category wc ON wc.id = wt.category_id
LEFT JOIN wallet w2 ON w2.id = wt.related_wallet_id
WHERE wt.wallet_id = $1
ORDER BY wt.transaction_time DESC
LIMIT $2 OFFSET $3;

-- name: GetWalletBalance :one
SELECT COALESCE(
    SUM(CASE
        WHEN type IN ('INCOME', 'TRANSFER_IN', 'PORTFOLIO_WITHDRAWAL') THEN amount
        ELSE -amount
    END), 0
)::NUMERIC AS balance
FROM wallet_transaction
WHERE wallet_id = $1;

-- name: GetWalletBalanceAsOf :one
SELECT COALESCE(
    SUM(CASE
        WHEN type IN ('INCOME', 'TRANSFER_IN', 'PORTFOLIO_WITHDRAWAL') THEN amount
        ELSE -amount
    END), 0
)::NUMERIC AS balance
FROM wallet_transaction
WHERE wallet_id = $1
  AND transaction_time <= $2;
