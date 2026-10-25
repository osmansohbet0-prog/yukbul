-- Additive: preserve existing category and manlift constraints and all listing rows.
ALTER TABLE listings ADD COLUMN service_category TEXT CHECK(service_category IS NULL OR service_category='mobile_tire');
CREATE INDEX listings_service_category_idx ON listings(service_category,city,status);
