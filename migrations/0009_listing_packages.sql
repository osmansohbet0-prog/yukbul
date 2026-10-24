ALTER TABLE listings ADD COLUMN package_tier TEXT NOT NULL DEFAULT 'standard' CHECK(package_tier IN ('standard','featured','premium'));
ALTER TABLE listings ADD COLUMN package_assigned_at INTEGER;
ALTER TABLE listings ADD COLUMN package_assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS listings_package_status_created_idx ON listings(package_tier,status,created_at DESC);
