-- CardStack Card/Payment Information Store (Technical Specification §3).
-- Written for SQLite in local development. Moving to Supabase needs a PostgreSQL
-- version of this file (BLOB becomes BYTEA, TEXT timestamps become TIMESTAMPTZ).

CREATE TABLE IF NOT EXISTS user (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  google_sub  TEXT UNIQUE,
  name        TEXT,
  created_at  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS session (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS institution_link (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  plaid_item_id   TEXT NOT NULL,
  institution_id  TEXT NOT NULL,
  institution     TEXT NOT NULL,
  status          TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

-- Credit cards CardStack may charge. processor_token is AES-256-GCM encrypted (NFR-04).
-- Only last4 is kept; never the PAN (NFR-03).
CREATE TABLE IF NOT EXISTS user_card (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  institution_link_id TEXT NOT NULL REFERENCES institution_link(id) ON DELETE CASCADE,
  plaid_account_id    TEXT NOT NULL,
  card_product_id     TEXT NOT NULL,
  processor_token     BLOB NOT NULL,
  last4               TEXT NOT NULL,
  network             TEXT NOT NULL,
  nickname            TEXT,
  preferred           INTEGER NOT NULL DEFAULT 0,
  active              INTEGER NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'active',
  expires_at          TEXT,
  credit_limit_cents  INTEGER NOT NULL DEFAULT 0,
  balance_cents       INTEGER NOT NULL DEFAULT 0,
  choices             TEXT NOT NULL DEFAULT '[]',
  rotating_active     TEXT NOT NULL DEFAULT '[]',
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS user_card_user ON user_card(user_id, active);

-- Non-card accounts (checking, savings) shown by the financial aggregator only.
CREATE TABLE IF NOT EXISTS linked_account (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  institution_link_id TEXT NOT NULL REFERENCES institution_link(id) ON DELETE CASCADE,
  plaid_account_id    TEXT NOT NULL,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL,
  subtype             TEXT NOT NULL,
  mask                TEXT NOT NULL,
  balance_cents       INTEGER NOT NULL
);

-- Spending pulled from linked institutions for the aggregator view.
CREATE TABLE IF NOT EXISTS external_transaction (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  account_ref   TEXT NOT NULL,
  date          TEXT NOT NULL,
  merchant      TEXT NOT NULL,
  category      TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS external_tx_user ON external_transaction(user_id, date);

CREATE TABLE IF NOT EXISTS merchant (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  brand        TEXT,
  webhook_url  TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  flagged      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checkout_button (
  button_id       TEXT PRIMARY KEY,
  merchant_id     TEXT NOT NULL REFERENCES merchant(id),
  allowed_domain  TEXT NOT NULL,
  display_config  TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS checkout_button_domain ON checkout_button(allowed_domain);

CREATE TABLE IF NOT EXISTS "transaction" (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES user(id),
  card_id         TEXT REFERENCES user_card(id),
  merchant_id     TEXT NOT NULL REFERENCES merchant(id),
  order_id        TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  category        TEXT NOT NULL,
  state           TEXT NOT NULL,
  error_code      TEXT,
  charge_id       TEXT,
  points_earned_cents INTEGER NOT NULL DEFAULT 0,
  return_url      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS transaction_user ON "transaction"(user_id, created_at);
CREATE INDEX IF NOT EXISTS transaction_state ON "transaction"(state, updated_at);

CREATE TABLE IF NOT EXISTS selection_log (
  transaction_id  TEXT NOT NULL REFERENCES "transaction"(id),
  chosen_card_id  TEXT NOT NULL,
  rule_id         TEXT NOT NULL,
  reason          TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

-- One row per processor call. The first attempt uses the transactionId as the
-- idempotency key (REQ-05); a consented fallback card gets transactionId:n.
CREATE TABLE IF NOT EXISTS charge_attempt (
  id               TEXT PRIMARY KEY,
  transaction_id   TEXT NOT NULL REFERENCES "transaction"(id),
  card_id          TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL,
  charge_id        TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_delivery (
  id              TEXT PRIMARY KEY,
  transaction_id  TEXT NOT NULL REFERENCES "transaction"(id),
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_retry_at   TEXT NOT NULL,
  status          TEXT NOT NULL,
  last_error      TEXT
);

-- Receipt and notification outbox (REQ-13). In development the email is written to the log.
CREATE TABLE IF NOT EXISTS notification (
  id              TEXT PRIMARY KEY,
  transaction_id  TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  type            TEXT NOT NULL,
  email           TEXT NOT NULL,
  status          TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  sent_at         TEXT
);
