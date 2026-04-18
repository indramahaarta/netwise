CREATE TABLE IF NOT EXISTS portfolio_fee (
    id               BIGSERIAL PRIMARY KEY,
    portfolio_id     BIGINT        NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    amount           NUMERIC(20,8) NOT NULL,
    note             TEXT,
    transaction_time TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_fee_portfolio_id ON portfolio_fee(portfolio_id);
