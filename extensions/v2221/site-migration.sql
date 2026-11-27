CREATE TABLE IF NOT EXISTS v2221_unique_visits (
 listing_id TEXT NOT NULL REFERENCES listings(id),
 day TEXT NOT NULL,
 visitor_hash TEXT NOT NULL,
 PRIMARY KEY(listing_id,day,visitor_hash)
);
CREATE INDEX IF NOT EXISTS v2221_unique_day ON v2221_unique_visits(day);
CREATE TABLE IF NOT EXISTS v2221_unique_daily (
 listing_id TEXT NOT NULL REFERENCES listings(id),
 day TEXT NOT NULL,
 visitors INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(listing_id,day)
);
CREATE TABLE IF NOT EXISTS v2221_favorites (
 user_id TEXT NOT NULL REFERENCES users(id),
 listing_id TEXT NOT NULL REFERENCES listings(id),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 PRIMARY KEY(user_id,listing_id)
);
CREATE INDEX IF NOT EXISTS v2221_favorites_listing ON v2221_favorites(listing_id);
CREATE TABLE IF NOT EXISTS v2221_favorite_adds (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 listing_id TEXT NOT NULL REFERENCES listings(id),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX IF NOT EXISTS v2221_favorite_adds_listing_time ON v2221_favorite_adds(listing_id,created_at);
CREATE TABLE IF NOT EXISTS v2221_interactions (
 id TEXT PRIMARY KEY,
 listing_id TEXT NOT NULL REFERENCES listings(id),
 owner_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('phone','whatsapp')),
 visitor_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 read_at INTEGER
);
CREATE INDEX IF NOT EXISTS v2221_interactions_dedup ON v2221_interactions(listing_id,kind,visitor_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS v2221_interactions_owner ON v2221_interactions(owner_id,read_at,created_at DESC);

