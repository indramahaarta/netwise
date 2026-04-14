CREATE TABLE IF NOT EXISTS wallet_category (
    id        BIGSERIAL    PRIMARY KEY,
    user_id   BIGINT       REFERENCES "user"(id) ON DELETE CASCADE,
    name      VARCHAR(100) NOT NULL,
    type      VARCHAR(10)  NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    is_system BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_wallet_category_user ON wallet_category(user_id);

INSERT INTO wallet_category (user_id, name, type, is_system) VALUES
  (NULL, 'Salary',            'INCOME',  TRUE),
  (NULL, 'Freelance',         'INCOME',  TRUE),
  (NULL, 'Investment Return', 'INCOME',  TRUE),
  (NULL, 'Gift',              'INCOME',  TRUE),
  (NULL, 'Initial Balance',   'INCOME',  TRUE),
  (NULL, 'Other Income',      'INCOME',  TRUE),
  (NULL, 'Food & Dining',     'EXPENSE', TRUE),
  (NULL, 'Transportation',    'EXPENSE', TRUE),
  (NULL, 'Shopping',          'EXPENSE', TRUE),
  (NULL, 'Bills & Utilities', 'EXPENSE', TRUE),
  (NULL, 'Healthcare',        'EXPENSE', TRUE),
  (NULL, 'Entertainment',     'EXPENSE', TRUE),
  (NULL, 'Home',              'EXPENSE', TRUE),
  (NULL, 'Education',         'EXPENSE', TRUE),
  (NULL, 'Other Expense',     'EXPENSE', TRUE);
