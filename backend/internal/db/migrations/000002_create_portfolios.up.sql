CREATE TABLE IF NOT EXISTS portfolio (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    currency     VARCHAR(10)  NOT NULL DEFAULT 'USD',
    cash         NUMERIC(20,8) NOT NULL DEFAULT 0,
    updated_time TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_time TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user_id ON portfolio(user_id);
