CREATE TABLE IF NOT EXISTS "user" (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,
    finnhub_api_key VARCHAR(512),
    updated_time    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_time    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
