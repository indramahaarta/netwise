CREATE TABLE IF NOT EXISTS dividend (
    id               BIGSERIAL PRIMARY KEY,
    portfolio_id     BIGINT        NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    ticker_id        BIGINT        NOT NULL REFERENCES ticker(id),
    currency         VARCHAR(10)   NOT NULL,
    amount           NUMERIC(20,8) NOT NULL,
    transaction_time TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dividend_portfolio_id ON dividend(portfolio_id);
