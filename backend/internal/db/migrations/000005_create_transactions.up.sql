CREATE TABLE IF NOT EXISTS transaction (
    id               BIGSERIAL PRIMARY KEY,
    portfolio_id     BIGINT        NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    ticker_id        BIGINT        NOT NULL REFERENCES ticker(id),
    side             VARCHAR(4)    NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity         NUMERIC(20,8) NOT NULL,
    price            NUMERIC(20,8) NOT NULL,
    realized_gain    NUMERIC(20,8) NOT NULL DEFAULT 0,
    fee              NUMERIC(20,8) NOT NULL DEFAULT 0,
    total_amount     NUMERIC(20,8) NOT NULL,
    transaction_time TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_portfolio_ticker_side
    ON transaction(portfolio_id, ticker_id, side);
CREATE INDEX IF NOT EXISTS idx_transaction_portfolio_time
    ON transaction(portfolio_id, transaction_time);
