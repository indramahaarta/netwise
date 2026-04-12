CREATE TABLE IF NOT EXISTS holding (
    id           BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT        NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    ticker_id    BIGINT        NOT NULL REFERENCES ticker(id),
    avg          NUMERIC(20,8) NOT NULL DEFAULT 0,
    share        NUMERIC(20,8) NOT NULL DEFAULT 0,
    updated_time TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_time TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (portfolio_id, ticker_id)
);

CREATE INDEX IF NOT EXISTS idx_holding_portfolio_id ON holding(portfolio_id);
