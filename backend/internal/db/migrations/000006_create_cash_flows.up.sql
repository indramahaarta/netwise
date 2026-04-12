CREATE TABLE IF NOT EXISTS cash_flow (
    id               BIGSERIAL PRIMARY KEY,
    portfolio_id     BIGINT        NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    type             VARCHAR(10)   NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL')),
    source_amount    NUMERIC(20,8) NOT NULL,
    source_currency  VARCHAR(10)   NOT NULL,
    target_amount    NUMERIC(20,8) NOT NULL,
    target_currency  VARCHAR(10)   NOT NULL,
    broker_rate      NUMERIC(20,8),
    transaction_time TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_portfolio_time
    ON cash_flow(portfolio_id, transaction_time);
