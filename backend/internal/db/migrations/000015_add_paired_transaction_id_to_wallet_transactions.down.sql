DROP INDEX IF EXISTS idx_wallet_tx_paired;
ALTER TABLE wallet_transaction DROP COLUMN IF EXISTS paired_transaction_id;
