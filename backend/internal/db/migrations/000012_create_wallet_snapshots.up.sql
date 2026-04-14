CREATE TABLE IF NOT EXISTS wallet_snapshot (
    id            BIGSERIAL     PRIMARY KEY,
    wallet_id     BIGINT        NOT NULL REFERENCES wallet(id) ON DELETE CASCADE,
    balance       NUMERIC(20,8) NOT NULL,
    balance_usd   NUMERIC(20,8) NOT NULL,
    snapshot_date DATE          NOT NULL,
    UNIQUE (wallet_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_wallet_snapshot_date ON wallet_snapshot(wallet_id, snapshot_date);
