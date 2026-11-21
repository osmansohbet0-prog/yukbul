CREATE TABLE IF NOT EXISTS tender_notification_state (
  id INTEGER PRIMARY KEY CHECK(id=1), activated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO tender_notification_state(id,activated_at) VALUES(1,unixepoch());
CREATE TABLE IF NOT EXISTS tender_email_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  unsubscribe_token TEXT NOT NULL UNIQUE,
  subscribed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tender_email_outbox (
  user_id TEXT NOT NULL REFERENCES users(id), lead_id TEXT NOT NULL REFERENCES lead_radar_leads(id),
  status TEXT NOT NULL CHECK(status IN ('queued','sending','sent','uncertain','cancelled')),
  created_at INTEGER NOT NULL, attempted_at INTEGER, sent_at INTEGER, error_code TEXT,
  PRIMARY KEY(user_id,lead_id)
);
CREATE INDEX IF NOT EXISTS tender_email_outbox_status ON tender_email_outbox(status,created_at);
CREATE INDEX IF NOT EXISTS lead_radar_public_recent ON lead_radar_leads(status,public_at DESC);
