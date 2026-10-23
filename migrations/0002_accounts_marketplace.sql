-- Aşama 3: kullanıcı oturumları, fotoğraflar, içerik tekrar koruması ve site medya dosyaları.
ALTER TABLE listings ADD COLUMN content_hash TEXT;
CREATE INDEX IF NOT EXISTS listings_content_hash_idx ON listings(content_hash, created_at DESC);
ALTER TABLE listing_photos ADD COLUMN mime_type TEXT NOT NULL DEFAULT 'image/webp';
ALTER TABLE listing_photos ADD COLUMN byte_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE listing_photos ADD COLUMN image_blob BLOB;

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS user_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('register','login','ai','listing','report')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS user_attempts_ip_time_idx ON user_login_attempts(ip_hash, action, created_at);
CREATE TABLE IF NOT EXISTS site_assets (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL CHECK(asset_type IN ('logo','hero')),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/webp','image/jpeg','image/png')),
  byte_size INTEGER NOT NULL,
  image_blob BLOB NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, usage_date)
);
CREATE TABLE IF NOT EXISTS daily_listing_limits (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, usage_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_reports_member_once_idx
  ON listing_reports(listing_id, reporter_user_id) WHERE reporter_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS listings_content_hash_active_unique
  ON listings(content_hash) WHERE content_hash IS NOT NULL AND status<>'deleted';
UPDATE site_settings SET value_json=json_set(
  value_json,
  '$.seo_title','YükVinç — Vinç kiralama, yol yardım ve operatör ilanları',
  '$.seo_description','Vinç kiralama, oto kurtarıcı, iş makinesi ve operatör ilanlarını şehir, kategori ve fiyata göre ara; onaylı ilanları karşılaştır.',
  '$.about_text','YükVinç, makine ve araç sahiplerinin kiralama ilanlarıyla operatörlerin iş arayışlarını bir araya getiren bir kullanıcı pazaryeridir. İlanlar yayınlanmadan önce yönetici tarafından incelenir.',
  '$.faq[0].answer','Evet. Üyeler operatör iş arayışı ilanını ücretsiz oluşturabilir; ilan yayınlanmadan önce incelenir.',
  '$.faq[2].answer','Ana sayfada onaylanmış gerçek kullanıcı ilanları görünür. İlanların fiyat, kapsam ve müsaitliğini ilan sahibiyle doğrula.'
) WHERE setting_key='public_site';
