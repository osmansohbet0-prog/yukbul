CREATE TABLE IF NOT EXISTS v12_member_match_cache (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 fingerprint TEXT NOT NULL,
 result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 computed_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE IF NOT EXISTS v12_saved_tenders (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 lead_id TEXT NOT NULL REFERENCES lead_radar_leads(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 PRIMARY KEY(user_id,lead_id)
);
CREATE INDEX IF NOT EXISTS v12_public_deadline
 ON lead_radar_leads(public_expires_at,id) WHERE status='approved' AND public_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS v12_guardian_checks (
 service TEXT PRIMARY KEY,
 state TEXT NOT NULL CHECK(state IN ('ok','degraded','failed','unknown')),
 severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low')),
 detail TEXT NOT NULL,
 response_ms INTEGER NOT NULL,
 checked_at INTEGER NOT NULL,
 first_failure_at INTEGER
);
CREATE TABLE IF NOT EXISTS v12_guardian_lease (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 next_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS v12_advisor_usage (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 requested INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,day)
);
CREATE TABLE IF NOT EXISTS v12_guardian_incidents (
 id INTEGER PRIMARY KEY,
 service TEXT NOT NULL,
 severity TEXT NOT NULL,
 detail TEXT NOT NULL,
 remedy TEXT NOT NULL,
 opened_at INTEGER NOT NULL DEFAULT(unixepoch()),
 resolved_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS v12_guardian_one_incident
 ON v12_guardian_incidents(service) WHERE resolved_at IS NULL;
CREATE TABLE IF NOT EXISTS v12_tender_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 site_enabled INTEGER NOT NULL DEFAULT 0 CHECK(site_enabled IN (0,1)),
 email_enabled INTEGER NOT NULL DEFAULT 0 CHECK(email_enabled IN (0,1))
);
CREATE TABLE IF NOT EXISTS v12_tender_alerts (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 lead_id TEXT NOT NULL REFERENCES lead_radar_leads(id) ON DELETE CASCADE,
 site_visible INTEGER NOT NULL DEFAULT 0 CHECK(site_visible IN (0,1)),
 read_at INTEGER,
 state TEXT NOT NULL CHECK(state IN ('none','queued','sending','sent','uncertain','abandoned','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL DEFAULT(unixepoch()),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 sent_at INTEGER,
 PRIMARY KEY(user_id,lead_id)
);
CREATE INDEX IF NOT EXISTS v12_tender_due ON v12_tender_alerts(state,next_at) WHERE state IN ('queued','sending');
CREATE TABLE IF NOT EXISTS v12_tender_scan (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 cursor TEXT NOT NULL,
 next_at INTEGER NOT NULL
);
