-- name: CreateWalletTransaction :one
INSERT INTO wallet_transaction (
    wallet_id, type, amount, category_id,
    related_wallet_id, related_portfolio_id, broker_rate, note, transaction_time, paired_transaction_id
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: SetPairedTransactionID :exec
UPDATE wallet_transaction SET paired_transaction_id = $2 WHERE id = $1;

-- name: DeleteWalletTransactionWithPair :exec
DELETE FROM wallet_transaction
WHERE wallet_transaction.id = $1
   OR wallet_transaction.id = (SELECT paired_transaction_id FROM wallet_transaction wt2 WHERE wt2.id = $1);

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

-- name: GetWalletTransaction :one
SELECT wt.*, wc.name AS category_name, w2.name AS related_wallet_name
FROM wallet_transaction wt
LEFT JOIN wallet_category wc ON wc.id = wt.category_id
LEFT JOIN wallet w2 ON w2.id = wt.related_wallet_id
WHERE wt.id = $1 AND wt.wallet_id = $2;

-- name: UpdateWalletTransaction :one
UPDATE wallet_transaction
SET type = $3, amount = $4, category_id = $5, note = $6, transaction_time = $7
WHERE id = $1 AND wallet_id = $2
RETURNING *;

-- name: DeleteWalletTransaction :exec
DELETE FROM wallet_transaction WHERE id = $1 AND wallet_id = $2;

-- name: GetWalletSummary :one
SELECT
    COALESCE(SUM(CASE WHEN type IN ('INCOME','TRANSFER_IN','PORTFOLIO_WITHDRAWAL') THEN amount ELSE 0 END), 0)::NUMERIC AS total_income,
    COALESCE(SUM(CASE WHEN type IN ('EXPENSE','TRANSFER_OUT','PORTFOLIO_DEPOSIT') THEN amount ELSE 0 END), 0)::NUMERIC AS total_expense
FROM wallet_transaction
WHERE wallet_id = $1
  AND transaction_time >= $2
  AND transaction_time < $3;

-- name: GetWalletCategoryBreakdown :many
SELECT
    wc.id AS category_id,
    wc.name AS category_name,
    wc.type AS category_type,
    COALESCE(SUM(wt.amount), 0)::NUMERIC AS total
FROM wallet_transaction wt
JOIN wallet_category wc ON wc.id = wt.category_id
WHERE wt.wallet_id = $1
  AND wt.transaction_time >= $2
  AND wt.transaction_time < $3
GROUP BY wc.id, wc.name, wc.type
ORDER BY total DESC;

-- name: ListWalletTransactionsByDateRange :many
SELECT
    wt.*,
    wc.name AS category_name,
    w2.name AS related_wallet_name
FROM wallet_transaction wt
LEFT JOIN wallet_category wc ON wc.id = wt.category_id
LEFT JOIN wallet w2 ON w2.id = wt.related_wallet_id
WHERE wt.wallet_id = $1
  AND wt.transaction_time >= $2
  AND wt.transaction_time < $3
ORDER BY wt.transaction_time DESC;

-- name: GetAggregatedWalletSummary :one
SELECT
    COALESCE(SUM(CASE WHEN wt.type IN ('INCOME','TRANSFER_IN','PORTFOLIO_WITHDRAWAL') THEN wt.amount ELSE 0 END), 0)::text AS total_income,
    COALESCE(SUM(CASE WHEN wt.type IN ('EXPENSE','TRANSFER_OUT','PORTFOLIO_DEPOSIT') THEN wt.amount ELSE 0 END), 0)::text AS total_expense
FROM wallet_transaction wt
JOIN wallet w ON w.id = wt.wallet_id
WHERE w.user_id = $1
  AND wt.transaction_time >= $2
  AND wt.transaction_time < $3;

-- name: GetAggregatedWalletCategoryBreakdown :many
SELECT
    wc.id AS category_id,
    wc.name AS category_name,
    wc.type AS category_type,
    COALESCE(SUM(wt.amount), 0)::text AS total
FROM wallet_transaction wt
JOIN wallet_category wc ON wc.id = wt.category_id
JOIN wallet w ON w.id = wt.wallet_id
WHERE w.user_id = $1
  AND wt.transaction_time >= $2
  AND wt.transaction_time < $3
  AND wt.type IN ('INCOME', 'EXPENSE')
GROUP BY wc.id, wc.name, wc.type
ORDER BY total DESC
LIMIT 5;
