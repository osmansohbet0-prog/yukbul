-- 30 günlük ücretsiz yayın dönemi ekipman ilanlarında; iş arayan operatör ilanları ücretsiz kalır.
ALTER TABLE listings ADD COLUMN trial_expires_at INTEGER;
ALTER TABLE listings ADD COLUMN paid_until INTEGER;

-- Halihazırda onaylı ekipman ilanlarına yayından itibaren 30 gün ücretsiz süre tanı.
UPDATE listings
SET trial_expires_at = unixepoch() + 2592000
WHERE status = 'approved'
  AND category <> 'operator'
  AND trial_expires_at IS NULL;
