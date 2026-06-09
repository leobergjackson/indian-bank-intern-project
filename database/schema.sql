-- Banking Alert Management System — reference schema (SQLite)
-- The application creates these tables automatically via SQLAlchemy.
-- This file documents the schema and can seed a DB manually if desired.

PRAGMA foreign_keys = ON;

-- Configurable rules that define when an alert fires --------------------------
CREATE TABLE IF NOT EXISTS alert_rules (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                VARCHAR(120) NOT NULL,
    description         TEXT DEFAULT '',
    category            VARCHAR(20)  NOT NULL,           -- Fraud / Compliance / Risk / Performance
    severity            VARCHAR(10)  NOT NULL,           -- Critical / High / Medium / Low
    metric              VARCHAR(40)  NOT NULL,           -- transaction_amount, fund_transfer_amount,
                                                         -- transaction_count, failed_login_count, login_location
    operator            VARCHAR(3)   NOT NULL DEFAULT '>',
    threshold_value     REAL         NOT NULL DEFAULT 0,
    time_window_seconds INTEGER      NOT NULL DEFAULT 0, -- for rate-based metrics
    enabled             BOOLEAN      NOT NULL DEFAULT 1,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Triggered alert events ------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id         INTEGER,
    rule_name       VARCHAR(120) NOT NULL,
    category        VARCHAR(20)  NOT NULL,
    severity        VARCHAR(10)  NOT NULL,
    status          VARCHAR(15)  NOT NULL DEFAULT 'Active',  -- Active / Acknowledged / Resolved
    metric          VARCHAR(40)  NOT NULL,
    threshold_value REAL         NOT NULL DEFAULT 0,
    actual_value    REAL         NOT NULL DEFAULT 0,
    source          VARCHAR(80)  DEFAULT '',
    message         TEXT         DEFAULT '',
    triggered_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME,
    acknowledged_by VARCHAR(80),
    resolved_at     DATETIME,
    resolved_by     VARCHAR(80),
    FOREIGN KEY (rule_id) REFERENCES alert_rules (id)
);

-- Monitored transactions / events --------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  VARCHAR(40) NOT NULL,
    amount      REAL        NOT NULL DEFAULT 0,
    txn_type    VARCHAR(20) NOT NULL DEFAULT 'transfer',  -- transfer / withdrawal / deposit / login
    location    VARCHAR(60) DEFAULT '',
    ip_address  VARCHAR(45) DEFAULT '',
    status      VARCHAR(20) DEFAULT 'success',            -- success / failed (logins)
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions (account_id);

-- System / application logs ---------------------------------------------------
CREATE TABLE IF NOT EXISTS system_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    level      VARCHAR(10) NOT NULL DEFAULT 'INFO',       -- INFO / WARNING / ERROR
    category   VARCHAR(30) NOT NULL DEFAULT 'system',
    message    TEXT        DEFAULT '',
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs (created_at);

-- Example seed rules (optional) ----------------------------------------------
INSERT INTO alert_rules (name, description, category, severity, metric, operator, threshold_value, time_window_seconds)
VALUES
 ('High-value transaction', 'Single transaction above ₹50 lakh.', 'Compliance', 'High', 'transaction_amount', '>', 5000000, 0),
 ('Large fund transfer', 'Fund transfer above ₹1 crore.', 'Risk', 'Critical', 'fund_transfer_amount', '>', 10000000, 0),
 ('Rapid transaction pattern', '5+ transactions within 10 minutes.', 'Fraud', 'High', 'transaction_count', '>=', 5, 600),
 ('Repeated failed logins', '3+ failed logins within 5 minutes.', 'Fraud', 'Critical', 'failed_login_count', '>=', 3, 300),
 ('Unusual login location', 'Login from an unrecognised location.', 'Fraud', 'Medium', 'login_location', '>=', 1, 0);
