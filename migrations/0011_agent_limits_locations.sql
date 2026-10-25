CREATE TABLE IF NOT EXISTS ai_model_budget (
 day TEXT NOT NULL,
 actor TEXT NOT NULL,
 calls INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,actor)
);
CREATE TABLE IF NOT EXISTS listing_locations (
 listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 verified_by TEXT NOT NULL REFERENCES users(id),
 updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE IF NOT EXISTS price_check_limits (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,day)
);
