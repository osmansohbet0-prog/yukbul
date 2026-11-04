-- Additive and isolated: no crane radar or existing laboratory records changed.
CREATE TABLE IF NOT EXISTS university_catalog (
 id TEXT PRIMARY KEY,name TEXT NOT NULL,city TEXT NOT NULL,kind TEXT NOT NULL,
 homepage TEXT NOT NULL,directory_url TEXT NOT NULL,checked_on TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS university_sources (
 id TEXT PRIMARY KEY,university_id TEXT REFERENCES university_catalog(id),kind TEXT NOT NULL,
 url TEXT NOT NULL UNIQUE,label TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,
 interval_seconds INTEGER NOT NULL DEFAULT 86400,next_scan_at INTEGER NOT NULL DEFAULT 0,
 last_scan_at INTEGER,last_success_at INTEGER,health TEXT NOT NULL DEFAULT 'not_checked',
 permission_status TEXT NOT NULL DEFAULT 'pending',last_error TEXT,etag TEXT,last_modified TEXT,
 failures INTEGER NOT NULL DEFAULT 0,lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,
 items_seen INTEGER NOT NULL DEFAULT 0,coverage_note TEXT NOT NULL DEFAULT 'İlk sayfa; arşiv ve PDF ekleri tam taranmaz.'
);
CREATE INDEX IF NOT EXISTS university_source_due ON university_sources(enabled,next_scan_at,lease_until);
CREATE TABLE IF NOT EXISTS university_notices (
 id TEXT PRIMARY KEY,university_id TEXT REFERENCES university_catalog(id),source_id TEXT REFERENCES university_sources(id),
 source_url TEXT NOT NULL UNIQUE,title TEXT NOT NULL,role_tag TEXT NOT NULL DEFAULT 'other_4b',
 kpss_tag TEXT NOT NULL DEFAULT 'unknown',kpss_years TEXT NOT NULL DEFAULT '[]',score_types TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'unverified',deadline INTEGER,starts_at INTEGER,published_at INTEGER,fingerprint TEXT,
 duplicate_of TEXT REFERENCES university_notices(id),evidence TEXT NOT NULL DEFAULT '[]',reason TEXT NOT NULL DEFAULT '',
 checked_at INTEGER,last_seen_at INTEGER NOT NULL,first_seen_at INTEGER NOT NULL,failures INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS university_notices_recheck ON university_notices(checked_at,source_id);
CREATE INDEX IF NOT EXISTS university_notices_fingerprint ON university_notices(fingerprint);
CREATE TABLE IF NOT EXISTS university_notice_links (
 notice_id TEXT REFERENCES university_notices(id),url TEXT NOT NULL PRIMARY KEY,source_id TEXT REFERENCES university_sources(id),last_seen_at INTEGER NOT NULL
);
