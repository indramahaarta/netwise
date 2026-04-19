-- name: UpsertWalletSnapshot :one
INSERT INTO wallet_snapshot (wallet_id, balance, balance_usd, snapshot_date)
VALUES ($1, $2, $3, $4)
ON CONFLICT (wallet_id, snapshot_date) DO UPDATE
    SET balance     = EXCLUDED.balance,
        balance_usd = EXCLUDED.balance_usd
RETURNING *;

-- name: ListWalletSnapshots :many
SELECT * FROM wallet_snapshot
WHERE wallet_id = $1
  AND snapshot_date >= $2
  AND snapshot_date <= $3
ORDER BY snapshot_date ASC;

-- name: GetAggregatedWalletSnapshots :many
SELECT
    ws.snapshot_date,
    SUM(ws.balance::numeric)::text AS total_balance
FROM wallet_snapshot ws
JOIN wallet w ON w.id = ws.wallet_id
WHERE w.user_id = $1
  AND ws.snapshot_date >= $2
  AND ws.snapshot_date <= $3
GROUP BY ws.snapshot_date
ORDER BY ws.snapshot_date ASC;
