CREATE TABLE IF NOT EXISTS wallet (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    currency     VARCHAR(3)   NOT NULL DEFAULT 'IDR',
    created_time TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_time TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet(user_id);
