-- Additive evidence and appeals. Existing listings and decisions are preserved.
CREATE TABLE IF NOT EXISTS listing_reviews (
 listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
 risk_score INTEGER NOT NULL CHECK(risk_score BETWEEN 0 AND 100),
 evidence_json TEXT NOT NULL DEFAULT '{}',
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE IF NOT EXISTS listing_appeals (
 id TEXT PRIMARY KEY,
 listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message_redacted TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX IF NOT EXISTS listing_appeals_status_idx ON listing_appeals(status,created_at);
CREATE TABLE IF NOT EXISTS moderation_feedback (
 id TEXT PRIMARY KEY,
 listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 admin_id TEXT NOT NULL REFERENCES users(id),
 verdict TEXT NOT NULL CHECK(verdict IN ('false_positive','confirmed')),
 evidence_json TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX IF NOT EXISTS moderation_feedback_created_idx ON moderation_feedback(created_at);
