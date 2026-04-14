CREATE TABLE IF NOT EXISTS wallet_transaction (
    id                   BIGSERIAL     PRIMARY KEY,
    wallet_id            BIGINT        NOT NULL REFERENCES wallet(id) ON DELETE CASCADE,
    type                 VARCHAR(25)   NOT NULL CHECK (type IN (
                             'INCOME', 'EXPENSE',
                             'TRANSFER_IN', 'TRANSFER_OUT',
                             'PORTFOLIO_DEPOSIT', 'PORTFOLIO_WITHDRAWAL'
                         )),
    amount               NUMERIC(20,8) NOT NULL,
    category_id          BIGINT        REFERENCES wallet_category(id),
    related_wallet_id    BIGINT        REFERENCES wallet(id),
    related_portfolio_id BIGINT        REFERENCES portfolio(id),
    broker_rate          NUMERIC(20,8),
    note                 TEXT,
    transaction_time     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_time
    ON wallet_transaction(wallet_id, transaction_time DESC);
