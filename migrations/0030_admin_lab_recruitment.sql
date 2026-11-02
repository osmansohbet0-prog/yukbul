-- Isolated admin-only recruitment store. No public job/radar tables are changed.
CREATE TABLE IF NOT EXISTS lab_recruitment_sources (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
 enabled INTEGER NOT NULL DEFAULT 1, interval_seconds INTEGER NOT NULL DEFAULT 21600,
 last_scan_at INTEGER, last_status TEXT NOT NULL DEFAULT 'not_scanned', last_error TEXT,
 items_seen INTEGER NOT NULL DEFAULT 0, lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lab_recruitment_jobs (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES lab_recruitment_sources(id),
 source_url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, organization TEXT NOT NULL DEFAULT '',
 city TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '',
 published_at INTEGER, deadline INTEGER, status TEXT NOT NULL DEFAULT 'unverified'
 CHECK(status IN ('open','closed','unverified','not_relevant')),
 reason TEXT NOT NULL DEFAULT '', evidence_json TEXT NOT NULL DEFAULT '[]',
 ai_status TEXT NOT NULL DEFAULT 'not_run', ai_note TEXT NOT NULL DEFAULT '',
 checked_at INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS lab_jobs_status_deadline ON lab_recruitment_jobs(status,deadline);
INSERT OR IGNORE INTO lab_recruitment_sources(id,name,url) VALUES
 ('kapadokya-career','Kapadokya Üniversitesi Kariyer — iş ilanları','https://kariyer.kapadokya.edu.tr/is-ilanlari/'),
 ('gazi-personnel','Gazi Üniversitesi Personel Dairesi','https://personel.gazi.edu.tr/');
