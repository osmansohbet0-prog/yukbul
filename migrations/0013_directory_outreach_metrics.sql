CREATE TABLE listing_directory (
 listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
 source TEXT NOT NULL DEFAULT 'owner' CHECK(source IN ('owner','map_no_website','low_traffic_website','promotion')),
 unaware INTEGER NOT NULL DEFAULT 0 CHECK(unaware IN (0,1)),
 contact_status TEXT NOT NULL DEFAULT 'Bilgilendirilmedi' CHECK(contact_status IN ('Bilgilendirilmedi','Bilgilendirildi','Arandı','Kabul etti','Düzeltme istedi','Kaldırma talebi')),
 contact_email TEXT, contact_note TEXT NOT NULL DEFAULT '', contact_at INTEGER,
 neighborhood TEXT, latitude REAL CHECK(latitude BETWEEN -90 AND 90),longitude REAL CHECK(longitude BETWEEN -180 AND 180),
 location_precision TEXT NOT NULL DEFAULT 'district_center' CHECK(location_precision IN ('district_center','admin_verified')),
 removed_at INTEGER, updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX directory_filters ON listing_directory(source,contact_status,removed_at);
CREATE TABLE outreach_suppression (
 identity_hash TEXT PRIMARY KEY, reason TEXT NOT NULL CHECK(reason IN ('RET','KALDIR')),
 listing_id TEXT REFERENCES listings(id), actor_id TEXT REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE outreach_requests (
 id TEXT PRIMARY KEY,listing_id TEXT NOT NULL REFERENCES listings(id),kind TEXT NOT NULL CHECK(kind IN ('RET','KALDIR','DUZELT')),
 note TEXT NOT NULL DEFAULT '',due_at INTEGER NOT NULL,resolved_at INTEGER,created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE outreach_drafts (
 id TEXT PRIMARY KEY,listing_id TEXT NOT NULL REFERENCES listings(id),created_by TEXT NOT NULL REFERENCES users(id),
 recipient_email TEXT,body TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','sending','sent','unknown','failed')),
 provider_id TEXT,created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE outreach_budget (day TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE outreach_inbox (message_id TEXT PRIMARY KEY,processed_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE listing_metric_dedup (id TEXT PRIMARY KEY,listing_id TEXT NOT NULL REFERENCES listings(id),kind TEXT NOT NULL CHECK(kind IN ('view','phone','whatsapp')),visitor_hash TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE INDEX metric_recent ON listing_metric_dedup(listing_id,kind,visitor_hash,created_at);
CREATE INDEX metric_expiry ON listing_metric_dedup(created_at);
CREATE TABLE listing_metrics_daily (listing_id TEXT NOT NULL REFERENCES listings(id),day TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('view','phone','whatsapp')),count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(listing_id,day,kind));
CREATE INDEX metric_day ON listing_metrics_daily(day);
CREATE INDEX outreach_draft_expiry ON outreach_drafts(updated_at);
