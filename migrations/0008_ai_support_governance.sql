CREATE TABLE IF NOT EXISTS ai_conversations (
 id TEXT PRIMARY KEY,
 conversation_id TEXT NOT NULL,
 user_message_redacted TEXT NOT NULL,
 assistant_answer_redacted TEXT,
 outcome TEXT NOT NULL DEFAULT 'answered' CHECK(outcome IN ('answered','unanswered','support','pricing','error')),
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS ai_conversations_created_idx ON ai_conversations(created_at DESC);
CREATE TABLE IF NOT EXISTS ai_audit (
 id TEXT PRIMARY KEY,
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 outcome TEXT NOT NULL,
 metadata_json TEXT NOT NULL DEFAULT '{}',
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS ai_audit_created_idx ON ai_audit(created_at DESC);
CREATE TABLE IF NOT EXISTS support_tickets (
 id TEXT PRIMARY KEY,
 source TEXT NOT NULL CHECK(source IN ('assistant','price_request','admin_action')),
 summary_redacted TEXT NOT NULL,
 contact_name TEXT,
 contact_details TEXT,
 consent_email INTEGER NOT NULL DEFAULT 0 CHECK(consent_email IN (0,1)),
 email_status TEXT NOT NULL DEFAULT 'not_requested' CHECK(email_status IN ('not_requested','sent','failed','not_configured')),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed','closed')),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS support_tickets_created_idx ON support_tickets(status,created_at DESC);
CREATE TABLE IF NOT EXISTS ai_improvement_suggestions (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 finding TEXT NOT NULL,
 rationale TEXT NOT NULL,
 proposal TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 pull_request_url TEXT,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 reviewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS ai_suggestions_status_idx ON ai_improvement_suggestions(status,created_at DESC);
