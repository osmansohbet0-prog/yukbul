-- Additive schema for company-name and perceptual-photo duplicate review signals.
ALTER TABLE listings ADD COLUMN business_name TEXT;
ALTER TABLE listing_photos ADD COLUMN visual_hash TEXT;
CREATE INDEX IF NOT EXISTS listings_business_name_idx ON listings(business_name, city, category, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_photos_visual_hash_idx ON listing_photos(visual_hash, listing_id);
