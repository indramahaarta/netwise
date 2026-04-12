CREATE TABLE IF NOT EXISTS portfolio_snapshot (
    id             BIGSERIAL PRIMARY KEY,
    portfolio_id   BIGINT        NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    total_equity   NUMERIC(20,8) NOT NULL DEFAULT 0,
    total_invested NUMERIC(20,8) NOT NULL DEFAULT 0,
    cash_balance   NUMERIC(20,8) NOT NULL DEFAULT 0,
    unrealized     NUMERIC(20,8) NOT NULL DEFAULT 0,
    realized       NUMERIC(20,8) NOT NULL DEFAULT 0,
    currency       VARCHAR(10)   NOT NULL DEFAULT 'USD',
    snapshot_date  DATE          NOT NULL,
    UNIQUE (portfolio_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshot_portfolio_date
    ON portfolio_snapshot(portfolio_id, snapshot_date);

CREATE TABLE IF NOT EXISTS ticker_snapshot (
    id            BIGSERIAL PRIMARY KEY,
    portfolio_id  BIGINT        NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
    ticker_id     BIGINT        NOT NULL REFERENCES ticker(id),
    price         NUMERIC(20,8) NOT NULL DEFAULT 0,
    currency      VARCHAR(10)   NOT NULL DEFAULT 'USD',
    quantity      NUMERIC(20,8) NOT NULL DEFAULT 0,
    avg           NUMERIC(20,8) NOT NULL DEFAULT 0,
    market_value  NUMERIC(20,8) NOT NULL DEFAULT 0,
    snapshot_date DATE          NOT NULL,
    UNIQUE (portfolio_id, ticker_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ticker_snapshot_portfolio_ticker_date
    ON ticker_snapshot(portfolio_id, ticker_id, snapshot_date);
