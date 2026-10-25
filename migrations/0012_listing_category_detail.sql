-- Preserve the original category constraint and every existing listing.
ALTER TABLE listings ADD COLUMN category_detail TEXT CHECK(category_detail IS NULL OR category_detail='manlift');
CREATE INDEX IF NOT EXISTS listings_category_detail_idx ON listings(category_detail,city,status);
