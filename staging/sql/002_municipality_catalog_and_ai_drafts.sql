-- YükVinç Radar 3.1, staging-only municipal discovery + AI descriptions. Idempotent.
-- Municipality directory entries are not automatically active scanning sources.
CREATE TABLE IF NOT EXISTS radar_municipalities (
 id TEXT PRIMARY KEY,
 municipality_name TEXT NOT NULL,
 province_name TEXT,
 municipality_type TEXT NOT NULL DEFAULT 'unknown',
 homepage_url TEXT,
 homepage_host TEXT,
 announcements_url TEXT,
 feed_url TEXT,
 catalog_source_url TEXT NOT NULL,
 discovery_status TEXT NOT NULL DEFAULT 'directory_only'
   CHECK(discovery_status IN ('directory_only','homepage_verified','announcement_found','announcement_verified','feed_verified','manual_only','blocked','error')),
 extraction_method TEXT NOT NULL DEFAULT 'directory',
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 scan_method TEXT NOT NULL DEFAULT 'manual' CHECK(scan_method IN ('manual','rss','permitted_html')),
 permissions_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(permissions_confirmed IN (0,1)),
 republication_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(republication_confirmed IN (0,1)),
 last_checked_at INTEGER,
 last_error TEXT,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS radar_municipalities_province_idx ON radar_municipalities(province_name,discovery_status,enabled);
CREATE INDEX IF NOT EXISTS radar_municipalities_scan_idx ON radar_municipalities(discovery_status,last_checked_at);
CREATE TABLE IF NOT EXISTS radar_municipality_sync (
 source_url TEXT PRIMARY KEY,
 cursor_offset INTEGER NOT NULL DEFAULT 0,
 total_discovered INTEGER NOT NULL DEFAULT 0,
 processed_count INTEGER NOT NULL DEFAULT 0,
 last_run_at INTEGER,
 last_success_at INTEGER,
 last_error TEXT
);
CREATE TABLE IF NOT EXISTS radar_editor_drafts (
 id TEXT PRIMARY KEY,
 lead_id TEXT REFERENCES lead_radar_leads(id) ON DELETE SET NULL,
 source_url TEXT NOT NULL,
 source_organization TEXT NOT NULL,
 factual_source_text TEXT NOT NULL,
 ai_title TEXT,
 ai_description TEXT,
 ai_model TEXT,
 ai_status TEXT NOT NULL DEFAULT 'queued'
   CHECK(ai_status IN ('queued','generated','failed','needs_review','approved','rejected')),
 review_notes TEXT,
 generated_at INTEGER,
 approved_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS radar_editor_drafts_status_idx ON radar_editor_drafts(ai_status, created_at DESC);
CREATE TABLE IF NOT EXISTS radar_ai_daily_limits (
 usage_day TEXT PRIMARY KEY,
 attempted INTEGER NOT NULL DEFAULT 0 CHECK(attempted>=0),
 completed INTEGER NOT NULL DEFAULT 0 CHECK(completed>=0),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);