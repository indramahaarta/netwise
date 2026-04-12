CREATE TABLE IF NOT EXISTS ticker (
    id           BIGSERIAL PRIMARY KEY,
    symbol       VARCHAR(20)  NOT NULL UNIQUE,
    name         VARCHAR(255) NOT NULL DEFAULT '',
    type         VARCHAR(50)  NOT NULL DEFAULT '',
    currency     VARCHAR(10)  NOT NULL DEFAULT 'USD',
    sector       VARCHAR(100) NOT NULL DEFAULT '',
    subsector    VARCHAR(100) NOT NULL DEFAULT '',
    updated_time TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_time TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
