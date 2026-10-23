-- Extend the existing rate-limit action constraint while preserving counters.
-- The earlier member-auth migration allowed only login/register, but runtime
-- also records ai/listing/report actions. Rebuild because SQLite cannot alter CHECK.
CREATE TABLE user_login_attempts_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('login', 'register', 'ai', 'listing', 'report')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO user_login_attempts_next (id, ip_hash, action, created_at)
SELECT id, ip_hash, action, created_at FROM user_login_attempts;
DROP TABLE user_login_attempts;
ALTER TABLE user_login_attempts_next RENAME TO user_login_attempts;
CREATE INDEX IF NOT EXISTS user_attempts_ip_time_idx
  ON user_login_attempts(ip_hash, action, created_at);
