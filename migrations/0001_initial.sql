CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_norm TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('equipment','operator_job')),
  category TEXT NOT NULL CHECK (category IN ('crane','tow','basket','machine','lift','operator')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  address TEXT,
  price_amount INTEGER,
  price_unit TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','flagged','deleted')),
  moderation_note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (price_amount IS NULL OR price_amount >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin_idx ON users(role) WHERE role='admin';

CREATE INDEX IF NOT EXISTS listings_status_created_idx ON listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS listings_user_idx ON listings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS listings_category_city_idx ON listings(category, city, status);

CREATE TABLE IF NOT EXISTS listing_photos (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS listing_reports (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS admin_login_attempts_ip_time_idx ON admin_login_attempts(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS admin_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS admin_activity_created_idx ON admin_activity(created_at DESC);

INSERT OR IGNORE INTO site_settings(setting_key, value_json) VALUES ('public_site', '{"brand_name":"YükVinç","logo_path":"/assets/mark.svg","primary_color":"#172d35","accent_color":"#f6a13b","font_family":"Inter, Arial, sans-serif","headline":"Makineyi bul. İşini büyüt.","introduction":"Vinç, çekici, forklift ve operatör ilanlarını tek yerde keşfet. İhtiyacına göre filtrele, fiyatları karşılaştır.","hero_image":"/assets/hero.svg","about_title":"Ekipmana da işe de yer var.","about_text":"Makine sahipleri ekipmanlarını kiralama ilanı olarak yayınlar. Operatörler de iş arayışlarını paylaşarak yeni fırsatlara ulaşır. Ziyaretçiler ilanları ücretsiz keşfeder; yeni ilanlar yayınlanmadan önce yönetici onayından geçer.","faq":[{"question":"İş arayan operatörler ilan verebilir mi?","answer":"Evet. Üyeler operatör iş arayışı ilanını ücretsiz oluşturabilir; ilan yayınlanmadan önce incelenir."},{"question":"Fiyatları karşılaştırabilir miyim?","answer":"Ekipman ilanlarında en fazla üç ilanı seçip fiyat ve özellikleri yan yana karşılaştırabilirsin. Fiyatlar ilan sahibinden ayrıca teyit edilmelidir."},{"question":"Bu sayfadaki ilanlar gerçek mi?","answer":"Ana sayfada onaylanmış gerçek kullanıcı ilanları görünür. Fiyat, kapsam ve müsaitliği ilan sahibiyle doğrula."}],"section_order":["ilanlar","nasil","about","faq","closing"],"sections":{"ilanlar":true,"nasil":true,"about":true,"faq":true,"closing":true}}');
