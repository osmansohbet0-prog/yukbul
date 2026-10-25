CREATE TABLE admin_activity (   id INTEGER PRIMARY KEY AUTOINCREMENT,   actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,   action TEXT NOT NULL,   entity_type TEXT,   entity_id TEXT,   metadata_json TEXT NOT NULL DEFAULT '{}',   created_at INTEGER NOT NULL DEFAULT (unixepoch()) );
CREATE TABLE admin_login_attempts (   id INTEGER PRIMARY KEY AUTOINCREMENT,   ip_hash TEXT NOT NULL,   created_at INTEGER NOT NULL DEFAULT (unixepoch()) );
CREATE TABLE admin_sessions (   token_hash TEXT PRIMARY KEY,   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,   expires_at INTEGER NOT NULL,   created_at INTEGER NOT NULL DEFAULT (unixepoch()) );
CREATE TABLE ai_audit (
 id TEXT PRIMARY KEY,
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 outcome TEXT NOT NULL,
 metadata_json TEXT NOT NULL DEFAULT '{}',
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE ai_conversations (
 id TEXT PRIMARY KEY,
 conversation_id TEXT NOT NULL,
 user_message_redacted TEXT NOT NULL,
 assistant_answer_redacted TEXT,
 outcome TEXT NOT NULL DEFAULT 'answered' CHECK(outcome IN ('answered','unanswered','support','pricing','error')),
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE ai_improvement_suggestions (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 finding TEXT NOT NULL,
 rationale TEXT NOT NULL,
 proposal TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 pull_request_url TEXT,
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 reviewed_at INTEGER
);
CREATE TABLE ai_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, usage_date)
);
CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);
CREATE TABLE daily_listing_limits (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, usage_date)
);
CREATE TABLE listing_appeals (
 id TEXT PRIMARY KEY,
 listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message_redacted TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE listing_photos (   id TEXT PRIMARY KEY,   listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,   object_key TEXT NOT NULL UNIQUE,   sort_order INTEGER NOT NULL DEFAULT 0,   created_at INTEGER NOT NULL DEFAULT (unixepoch()) , mime_type TEXT NOT NULL DEFAULT 'image/webp', byte_size INTEGER NOT NULL DEFAULT 0, image_blob BLOB, visual_hash TEXT);
CREATE TABLE listing_reports (   id TEXT PRIMARY KEY,   listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,   reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,   reason TEXT NOT NULL,   status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),   created_at INTEGER NOT NULL DEFAULT (unixepoch()) );
CREATE TABLE listing_reviews (
 listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
 risk_score INTEGER NOT NULL CHECK(risk_score BETWEEN 0 AND 100),
 evidence_json TEXT NOT NULL DEFAULT '{}',
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE listings (   id TEXT PRIMARY KEY,   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,   listing_type TEXT NOT NULL CHECK (listing_type IN ('equipment','operator_job')),   category TEXT NOT NULL CHECK (category IN ('crane','tow','basket','machine','lift','operator')),   title TEXT NOT NULL,   description TEXT NOT NULL,   city TEXT NOT NULL,   district TEXT NOT NULL,   address TEXT,   price_amount INTEGER,   price_unit TEXT,   contact_phone TEXT,   status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','flagged','deleted')),   moderation_note TEXT,   created_at INTEGER NOT NULL DEFAULT (unixepoch()),   updated_at INTEGER NOT NULL DEFAULT (unixepoch()), trial_expires_at INTEGER, paid_until INTEGER, content_hash TEXT, business_name TEXT, package_tier TEXT NOT NULL DEFAULT 'standard' CHECK(package_tier IN ('standard','featured','premium')), package_assigned_at INTEGER, package_assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,   CHECK (price_amount IS NULL OR price_amount >= 0) );
CREATE TABLE moderation_feedback (
 id TEXT PRIMARY KEY,
 listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 admin_id TEXT NOT NULL REFERENCES users(id),
 verdict TEXT NOT NULL CHECK(verdict IN ('false_positive','confirmed')),
 evidence_json TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE site_assets (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL CHECK(asset_type IN ('logo','hero')),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/webp','image/jpeg','image/png')),
  byte_size INTEGER NOT NULL,
  image_blob BLOB NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE site_settings (   setting_key TEXT PRIMARY KEY,   value_json TEXT NOT NULL,   updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,   updated_at INTEGER NOT NULL DEFAULT (unixepoch()) );
CREATE TABLE support_tickets (
 id TEXT PRIMARY KEY,
 source TEXT NOT NULL CHECK(source IN ('assistant','price_request','admin_action')),
 summary_redacted TEXT NOT NULL,
 contact_name TEXT,
 contact_details TEXT,
 consent_email INTEGER NOT NULL DEFAULT 0 CHECK(consent_email IN (0,1)),
 email_status TEXT NOT NULL DEFAULT 'not_requested' CHECK(email_status IN ('not_requested','sent','failed','not_configured')),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed','closed')),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE "user_login_attempts" (id INTEGER PRIMARY KEY AUTOINCREMENT, ip_hash TEXT NOT NULL, action TEXT NOT NULL CHECK (action IN ('login', 'register', 'ai', 'listing', 'report')), created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE user_sessions (   token_hash TEXT PRIMARY KEY,   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,   expires_at INTEGER NOT NULL,   created_at INTEGER NOT NULL DEFAULT (unixepoch()) );
CREATE TABLE users (   id TEXT PRIMARY KEY,   email TEXT NOT NULL,   email_norm TEXT NOT NULL UNIQUE,   password_hash TEXT,   role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),   active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),   created_at INTEGER NOT NULL DEFAULT (unixepoch()),   updated_at INTEGER NOT NULL DEFAULT (unixepoch()) , google_sub TEXT);
CREATE INDEX admin_activity_created_idx ON admin_activity(created_at DESC);
CREATE INDEX admin_login_attempts_ip_time_idx ON admin_login_attempts(ip_hash, created_at);
CREATE INDEX admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE INDEX ai_audit_created_idx ON ai_audit(created_at DESC);
CREATE INDEX ai_conversations_created_idx ON ai_conversations(created_at DESC);
CREATE INDEX ai_suggestions_status_idx ON ai_improvement_suggestions(status,created_at DESC);
CREATE INDEX listing_appeals_status_idx ON listing_appeals(status,created_at);
CREATE INDEX listing_photos_visual_hash_idx ON listing_photos(visual_hash, listing_id);
CREATE UNIQUE INDEX listing_reports_member_once_idx
  ON listing_reports(listing_id, reporter_user_id) WHERE reporter_user_id IS NOT NULL;
CREATE INDEX listings_business_name_idx ON listings(business_name, city, category, created_at DESC);
CREATE INDEX listings_category_city_idx ON listings(category, city, status);
CREATE UNIQUE INDEX listings_content_hash_active_unique
  ON listings(content_hash) WHERE content_hash IS NOT NULL AND status<>'deleted';
CREATE INDEX listings_content_hash_idx ON listings(content_hash, created_at DESC);
CREATE INDEX listings_package_status_created_idx ON listings(package_tier,status,created_at DESC);
CREATE INDEX listings_status_created_idx ON listings(status, created_at DESC);
CREATE INDEX listings_user_idx ON listings(user_id, created_at DESC);
CREATE INDEX moderation_feedback_created_idx ON moderation_feedback(created_at);
CREATE INDEX support_tickets_created_idx ON support_tickets(status,created_at DESC);
CREATE INDEX user_attempts_ip_time_idx ON user_login_attempts(ip_hash, action, created_at);
CREATE INDEX user_sessions_expiry_idx ON user_sessions(expires_at);
CREATE INDEX user_sessions_user_idx ON user_sessions(user_id);
CREATE UNIQUE INDEX users_google_sub_unique ON users(google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX users_single_admin_idx ON users(role) WHERE role='admin';
