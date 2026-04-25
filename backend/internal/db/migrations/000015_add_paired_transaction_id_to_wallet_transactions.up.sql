ALTER TABLE wallet_transaction
    ADD COLUMN paired_transaction_id BIGINT REFERENCES wallet_transaction(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_tx_paired ON wallet_transaction(paired_transaction_id);

-- Backfill: link existing TRANSFER_OUT/TRANSFER_IN pairs by matching swapped wallets, equal amount and time.
WITH pairs AS (
    SELECT a.id AS a_id, b.id AS b_id
    FROM wallet_transaction a
    JOIN wallet_transaction b
      ON b.wallet_id = a.related_wallet_id
     AND b.related_wallet_id = a.wallet_id
     AND b.amount = a.amount
     AND b.transaction_time = a.transaction_time
     AND ((a.type = 'TRANSFER_OUT' AND b.type = 'TRANSFER_IN')
       OR (a.type = 'TRANSFER_IN'  AND b.type = 'TRANSFER_OUT'))
    WHERE a.id < b.id
)
UPDATE wallet_transaction wt
SET paired_transaction_id = CASE
        WHEN wt.id = p.a_id THEN p.b_id
        WHEN wt.id = p.b_id THEN p.a_id
    END
FROM pairs p
WHERE wt.id IN (p.a_id, p.b_id);
