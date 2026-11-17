CREATE TABLE _cf_KV (
        key TEXT PRIMARY KEY,
        value BLOB
      ) WITHOUT ROWID;
CREATE TABLE admin_activity (   id INTEGER PRIMARY KEY AUTOINCREMENT,   actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,   action TEXT NOT NULL,   entity_type TEXT,   entity_id TEXT,   metadata_json TEXT NOT NULL DEFAULT '{}',   created_at INTEGER NOT NULL DEFAULT (unixepoch()) );
CREATE TABLE admin_login_attempts (   id INTEGER PRIMARY KEY AUTOINCREMENT,   ip_hash TEXT NOT NULL,   created_at INTEGER NOT NULL DEFAULT (unixepoch()) );
CREATE TABLE admin_login_codes (email_norm TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0), used_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
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
CREATE TABLE ai_model_budget (
 day TEXT NOT NULL,
 actor TEXT NOT NULL,
 calls INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,actor)
);
CREATE TABLE ai_suggestion_usage (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, usage_date TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0), PRIMARY KEY(user_id, usage_date));
CREATE TABLE ai_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, usage_date)
);
CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);
CREATE TABLE daily_job_limits (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count BETWEEN 0 AND 5),
  PRIMARY KEY(user_id,usage_date)
);
CREATE TABLE daily_listing_limits (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, usage_date)
);
CREATE TABLE email_verification_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE job_offers (
 id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES job_requests(id),bidder_id TEXT NOT NULL REFERENCES users(id),listing_id TEXT NOT NULL REFERENCES listings(id),
 price INTEGER NOT NULL CHECK(price>0),arrival TEXT NOT NULL,vat TEXT NOT NULL,travel TEXT NOT NULL,message TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','selected','withdrawn')),created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch()),UNIQUE(job_id,bidder_id)
);
CREATE TABLE job_photos (id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES job_requests(id),sort_order INTEGER NOT NULL,mime_type TEXT NOT NULL,image_blob BLOB NOT NULL,byte_size INTEGER NOT NULL);
CREATE TABLE job_requests (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,description TEXT NOT NULL,
 category TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL,urgency TEXT NOT NULL DEFAULT 'Standart',
 start_text TEXT NOT NULL,duration TEXT NOT NULL,payment TEXT NOT NULL DEFAULT 'Karşılıklı anlaşmayla',
 contact_phone TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','open','rejected','assigned','completed','cancelled')),
 moderation_note TEXT,selected_offer_id TEXT,created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE lab_recruitment_jobs (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES lab_recruitment_sources(id),
 source_url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, organization TEXT NOT NULL DEFAULT '',
 city TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '',
 published_at INTEGER, deadline INTEGER, status TEXT NOT NULL DEFAULT 'unverified'
 CHECK(status IN ('open','closed','unverified','not_relevant')),
 reason TEXT NOT NULL DEFAULT '', evidence_json TEXT NOT NULL DEFAULT '[]',
 ai_status TEXT NOT NULL DEFAULT 'not_run', ai_note TEXT NOT NULL DEFAULT '',
 checked_at INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE lab_recruitment_sources (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
 enabled INTEGER NOT NULL DEFAULT 1, interval_seconds INTEGER NOT NULL DEFAULT 21600,
 last_scan_at INTEGER, last_status TEXT NOT NULL DEFAULT 'not_scanned', last_error TEXT,
 items_seen INTEGER NOT NULL DEFAULT 0, lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE lead_radar_ai_drafts (
 lead_id TEXT PRIMARY KEY REFERENCES lead_radar_leads(id),
 revision TEXT NOT NULL,
 summary TEXT NOT NULL,
 source_hash TEXT NOT NULL,
 expires_at INTEGER,
 evidence_json TEXT NOT NULL,
 generated_at INTEGER NOT NULL DEFAULT(unixepoch()),
 generated_by TEXT NOT NULL
);
CREATE TABLE lead_radar_application_links (lead_id TEXT PRIMARY KEY REFERENCES lead_radar_leads(id) ON DELETE CASCADE, ikn TEXT, dt_no TEXT, portal_type TEXT NOT NULL DEFAULT 'unknown' CHECK(portal_type IN ('public_tender','direct_procurement','unknown')), official_application_url TEXT, official_notice_url TEXT, official_search_url TEXT NOT NULL, source_detail_url TEXT, verification_status TEXT NOT NULL DEFAULT 'search_required' CHECK(verification_status IN ('verified_direct','official_notice','search_required','candidate_review','not_applicable')), evidence_note TEXT NOT NULL DEFAULT '', evidence_source_url TEXT, resolver_method TEXT NOT NULL DEFAULT 'grounded_extraction', checked_at INTEGER NOT NULL DEFAULT(unixepoch()), created_at INTEGER NOT NULL DEFAULT(unixepoch()), updated_at INTEGER NOT NULL DEFAULT(unixepoch()), CHECK(official_application_url IS NULL OR verification_status='verified_direct'));
CREATE TABLE lead_radar_evidence (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES lead_radar_leads(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES lead_radar_sources(id),
  source_url TEXT NOT NULL UNIQUE,
  source_title TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL DEFAULT(unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE lead_radar_leads (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES lead_radar_sources(id),
  organization TEXT,
  title TEXT NOT NULL,
  city TEXT,
  district TEXT,
  service_type TEXT NOT NULL,
  published_at TEXT,
  source_url TEXT NOT NULL UNIQUE,
  source_excerpt TEXT,
  classification TEXT NOT NULL DEFAULT 'review' CHECK(classification IN ('relevant','irrelevant','uncertain','review')),
  confidence REAL NOT NULL DEFAULT 0 CHECK(confidence>=0 AND confidence<=1),
  verification TEXT NOT NULL DEFAULT 'unverified' CHECK(verification IN ('unverified','official_source','manual_reviewed')),
  status TEXT NOT NULL DEFAULT 'review' CHECK(status IN ('review','approved','dismissed','stale')),
  outreach_draft TEXT,
  contact_status TEXT NOT NULL DEFAULT 'not_contacted' CHECK(contact_status IN ('not_contacted','draft_ready','approved_for_manual_contact','contacted','opt_out')),
  created_at INTEGER NOT NULL DEFAULT(unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT(unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT(unixepoch()),
  stale_at INTEGER
, public_summary TEXT, public_at INTEGER, public_expires_at INTEGER, verified_at INTEGER, publication_method TEXT NOT NULL DEFAULT 'manual' CHECK(publication_method IN ('manual','automatic')));
CREATE TABLE lead_radar_provinces (
  province_code INTEGER PRIMARY KEY,
  province_name TEXT NOT NULL UNIQUE
);
CREATE TABLE lead_radar_review_events (
 id TEXT PRIMARY KEY,
 lead_id TEXT NOT NULL,
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 revision TEXT,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE lead_radar_scan_jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')), requested_by TEXT, created_at INTEGER NOT NULL DEFAULT(unixepoch()), started_at INTEGER, finished_at INTEGER, lease_until INTEGER NOT NULL DEFAULT 0, source_cursor TEXT NOT NULL DEFAULT '', source_total INTEGER NOT NULL DEFAULT 0, sources_scanned INTEGER NOT NULL DEFAULT 0, items_seen INTEGER NOT NULL DEFAULT 0, candidates_added INTEGER NOT NULL DEFAULT 0, duplicates_linked INTEGER NOT NULL DEFAULT 0, items_rejected INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0, last_error TEXT);
CREATE TABLE lead_radar_scan_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES lead_radar_sources(id),
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('ok','not_modified','error')),
  items_seen INTEGER NOT NULL DEFAULT 0,
  candidates_added INTEGER NOT NULL DEFAULT 0,
  duplicates_linked INTEGER NOT NULL DEFAULT 0,
  items_rejected INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
CREATE TABLE lead_radar_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK(source_type IN ('rss','manual')),
  terms_attested INTEGER NOT NULL DEFAULT 0 CHECK(terms_attested IN (0,1)),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  last_scan_at INTEGER,
  last_scan_status TEXT,
  last_scan_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT(unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT(unixepoch())
, auto_publish_enabled INTEGER NOT NULL DEFAULT 0 CHECK(auto_publish_enabled IN (0,1)), source_category TEXT NOT NULL DEFAULT 'other', access_method TEXT NOT NULL DEFAULT 'manual', permission_status TEXT NOT NULL DEFAULT 'unverified', province_codes_json TEXT NOT NULL DEFAULT '[]', scan_interval_seconds INTEGER NOT NULL DEFAULT 86400, last_success_at INTEGER, last_found_at INTEGER, consecutive_errors INTEGER NOT NULL DEFAULT 0, etag TEXT, last_modified TEXT, scan_lock_until INTEGER NOT NULL DEFAULT 0, republish_attested INTEGER NOT NULL DEFAULT 0 CHECK(republish_attested IN (0,1)), republish_terms_url TEXT, republish_checked_at INTEGER);
CREATE TABLE listing_appeals (
 id TEXT PRIMARY KEY,
 listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 message_redacted TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewed')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE listing_directory (
 listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
 source TEXT NOT NULL DEFAULT 'owner' CHECK(source IN ('owner','map_no_website','low_traffic_website','promotion')),
 unaware INTEGER NOT NULL DEFAULT 0 CHECK(unaware IN (0,1)),
 contact_status TEXT NOT NULL DEFAULT 'Bilgilendirilmedi' CHECK(contact_status IN ('Bilgilendirilmedi','Bilgilendirildi','Arandı','Kabul etti','Düzeltme istedi','Kaldırma talebi')),
 contact_email TEXT, contact_note TEXT NOT NULL DEFAULT '', contact_at INTEGER,
 neighborhood TEXT, latitude REAL CHECK(latitude BETWEEN -90 AND 90),longitude REAL CHECK(longitude BETWEEN -180 AND 180),
 location_precision TEXT NOT NULL DEFAULT 'district_center' CHECK(location_precision IN ('district_center','admin_verified')),
 removed_at INTEGER, updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE listing_locations (
 listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 verified_by TEXT NOT NULL REFERENCES users(id),
 updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE listing_metric_dedup (id TEXT PRIMARY KEY,listing_id TEXT NOT NULL REFERENCES listings(id),kind TEXT NOT NULL CHECK(kind IN ('view','phone','whatsapp')),visitor_hash TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE listing_metrics_daily (listing_id TEXT NOT NULL REFERENCES listings(id),day TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('view','phone','whatsapp')),count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(listing_id,day,kind));
CREATE TABLE listing_photos (   id TEXT PRIMARY KEY,   listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,   object_key TEXT NOT NULL UNIQUE,   sort_order INTEGER NOT NULL DEFAULT 0,   created_at INTEGER NOT NULL DEFAULT (unixepoch()) , mime_type TEXT NOT NULL DEFAULT 'image/webp', byte_size INTEGER NOT NULL DEFAULT 0, image_blob BLOB, visual_hash TEXT, thumbnail_blob BLOB, thumbnail_mime TEXT);
CREATE TABLE listing_reports (   id TEXT PRIMARY KEY,   listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,   reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,   reason TEXT NOT NULL,   status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),   created_at INTEGER NOT NULL DEFAULT (unixepoch()) );
CREATE TABLE listing_reviews (
 listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
 risk_score INTEGER NOT NULL CHECK(risk_score BETWEEN 0 AND 100),
 evidence_json TEXT NOT NULL DEFAULT '{}',
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE listings (   id TEXT PRIMARY KEY,   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,   listing_type TEXT NOT NULL CHECK (listing_type IN ('equipment','operator_job')),   category TEXT NOT NULL CHECK (category IN ('crane','tow','basket','machine','lift','operator')),   title TEXT NOT NULL,   description TEXT NOT NULL,   city TEXT NOT NULL,   district TEXT NOT NULL,   address TEXT,   price_amount INTEGER,   price_unit TEXT,   contact_phone TEXT,   status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','flagged','deleted')),   moderation_note TEXT,   created_at INTEGER NOT NULL DEFAULT (unixepoch()),   updated_at INTEGER NOT NULL DEFAULT (unixepoch()), trial_expires_at INTEGER, paid_until INTEGER, content_hash TEXT, business_name TEXT, package_tier TEXT NOT NULL DEFAULT 'standard' CHECK(package_tier IN ('standard','featured','premium')), package_assigned_at INTEGER, package_assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL, category_detail TEXT CHECK(category_detail IS NULL OR category_detail='manlift'), service_category TEXT CHECK(service_category IS NULL OR service_category='mobile_tire'), member_paused_at INTEGER, km_price INTEGER CHECK(km_price IS NULL OR km_price>=0),   CHECK (price_amount IS NULL OR price_amount >= 0) );
CREATE TABLE member_notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, target_url TEXT NOT NULL, entity_id TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), read_at INTEGER, UNIQUE(user_id, kind, entity_id));
CREATE TABLE moderation_feedback (
 id TEXT PRIMARY KEY,
 listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 admin_id TEXT NOT NULL REFERENCES users(id),
 verdict TEXT NOT NULL CHECK(verdict IN ('false_positive','confirmed')),
 evidence_json TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE outreach_budget (day TEXT PRIMARY KEY,count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE outreach_drafts (
 id TEXT PRIMARY KEY,listing_id TEXT NOT NULL REFERENCES listings(id),created_by TEXT NOT NULL REFERENCES users(id),
 recipient_email TEXT,body TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','sending','sent','unknown','failed')),
 provider_id TEXT,created_at INTEGER NOT NULL DEFAULT(unixepoch()),updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE outreach_inbox (message_id TEXT PRIMARY KEY,processed_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE TABLE outreach_requests (
 id TEXT PRIMARY KEY,listing_id TEXT NOT NULL REFERENCES listings(id),kind TEXT NOT NULL CHECK(kind IN ('RET','KALDIR','DUZELT')),
 note TEXT NOT NULL DEFAULT '',due_at INTEGER NOT NULL,resolved_at INTEGER,created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE outreach_suppression (
 identity_hash TEXT PRIMARY KEY, reason TEXT NOT NULL CHECK(reason IN ('RET','KALDIR')),
 listing_id TEXT REFERENCES listings(id), actor_id TEXT REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE price_check_limits (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,day)
);
CREATE TABLE publication_email_outbox(listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed','skipped')),attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL DEFAULT(unixepoch()),lease_until INTEGER,last_error_code TEXT,created_at INTEGER NOT NULL DEFAULT(unixepoch()),sent_at INTEGER);
CREATE TABLE radar_buyer_contacts (
 id TEXT PRIMARY KEY,
 lead_id TEXT REFERENCES lead_radar_leads(id) ON DELETE SET NULL,
 organization TEXT NOT NULL,
 city TEXT NOT NULL,
 district TEXT,
 business_phone TEXT,
 business_email TEXT,
 contact_page_url TEXT,
 contact_source_url TEXT NOT NULL,
 contact_role TEXT NOT NULL DEFAULT 'public_organization',
 source_kind TEXT NOT NULL CHECK(source_kind IN ('official_tender','official_organization_page','verified_business_listing')),
 verification TEXT NOT NULL DEFAULT 'source_checked'
    CHECK(verification IN ('unverified','source_checked','directly_confirmed')),
 demand_status TEXT NOT NULL DEFAULT 'historical'
    CHECK(demand_status IN ('historical','unknown','open_verified','closed')),
 contact_status TEXT NOT NULL DEFAULT 'not_contacted'
    CHECK(contact_status IN ('not_contacted','contacted','follow_up','opt_out')),
 buyer_note TEXT NOT NULL DEFAULT '',
 last_verified_at INTEGER,
 last_contacted_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 updated_at INTEGER NOT NULL DEFAULT(unixepoch()), deadline_at INTEGER,
 CHECK(business_phone IS NOT NULL OR business_email IS NOT NULL OR contact_page_url IS NOT NULL)
);
CREATE TABLE radar_city_sources (
 province_code INTEGER PRIMARY KEY CHECK(province_code BETWEEN 1 AND 81),
 province_name TEXT NOT NULL,
 municipality_name TEXT NOT NULL,
 homepage_url TEXT,
 announcements_url TEXT,
 directory_url TEXT NOT NULL,
 discovery_status TEXT NOT NULL DEFAULT 'pending',
 robots_status TEXT NOT NULL DEFAULT 'unchecked',
 reading_permission TEXT NOT NULL DEFAULT 'unverified',
 republication_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(republication_confirmed IN (0,1)),
 candidate_links_json TEXT NOT NULL DEFAULT '[]',
 checked_at INTEGER,
 error_message TEXT
, last_notice_scan_at INTEGER, last_notice_scan_status TEXT NOT NULL DEFAULT 'not_scanned', last_notice_scan_count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE radar_contact_audit (
 id TEXT PRIMARY KEY,
 contact_id TEXT NOT NULL REFERENCES radar_buyer_contacts(id) ON DELETE CASCADE,
 actor TEXT NOT NULL,
 event TEXT NOT NULL CHECK(event IN ('contact_added','verified','contacted','follow_up','opt_out','updated')),
 details TEXT NOT NULL DEFAULT '',
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
CREATE TABLE site_visits (id TEXT PRIMARY KEY, day TEXT NOT NULL, session_hash TEXT NOT NULL, path TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT(unixepoch()));
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
CREATE TABLE "user_login_attempts" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('register','login','ai','listing','report','avatar','profile','email_verify','job-create','job-offer')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE user_sessions (   token_hash TEXT PRIMARY KEY,   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,   expires_at INTEGER NOT NULL,   created_at INTEGER NOT NULL DEFAULT (unixepoch()) );
CREATE TABLE users (   id TEXT PRIMARY KEY,   email TEXT NOT NULL,   email_norm TEXT NOT NULL UNIQUE,   password_hash TEXT,   role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),   active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),   created_at INTEGER NOT NULL DEFAULT (unixepoch()),   updated_at INTEGER NOT NULL DEFAULT (unixepoch()) , google_sub TEXT, display_name TEXT, profile_city TEXT, profile_bio TEXT, email_verified_at INTEGER, email_notifications INTEGER NOT NULL DEFAULT 1 CHECK(email_notifications IN (0,1)), avatar_webp BLOB, avatar_updated_at INTEGER, company_name TEXT, profile_phone TEXT);
CREATE INDEX admin_activity_created_idx ON admin_activity(created_at DESC);
CREATE INDEX admin_login_attempts_ip_time_idx ON admin_login_attempts(ip_hash, created_at);
CREATE INDEX admin_login_codes_expiry_idx ON admin_login_codes(expires_at);
CREATE INDEX admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE INDEX ai_audit_created_idx ON ai_audit(created_at DESC);
CREATE INDEX ai_conversations_created_idx ON ai_conversations(created_at DESC);
CREATE INDEX ai_suggestions_status_idx ON ai_improvement_suggestions(status,created_at DESC);
CREATE INDEX daily_job_limits_date_idx ON daily_job_limits(usage_date);
CREATE INDEX directory_filters ON listing_directory(source,contact_status,removed_at);
CREATE INDEX email_verification_expiry_idx ON email_verification_tokens(expires_at);
CREATE INDEX job_offers_job ON job_offers(job_id,status);
CREATE INDEX job_offers_owner ON job_offers(bidder_id,created_at);
CREATE INDEX job_photos_job ON job_photos(job_id,sort_order);
CREATE INDEX job_requests_owner ON job_requests(user_id,created_at);
CREATE INDEX job_requests_public ON job_requests(status,city,category,created_at);
CREATE INDEX lab_jobs_status_deadline ON lab_recruitment_jobs(status,deadline);
CREATE INDEX lead_radar_evidence_lead_idx ON lead_radar_evidence(lead_id,last_seen_at DESC);
CREATE INDEX lead_radar_jobs_queue_idx ON lead_radar_scan_jobs(status,created_at);
CREATE INDEX lead_radar_leads_location_idx ON lead_radar_leads(city,service_type);
CREATE INDEX lead_radar_leads_status_idx ON lead_radar_leads(status,created_at DESC);
CREATE INDEX lead_radar_public_idx ON lead_radar_leads(public_at,public_expires_at);
CREATE INDEX lead_radar_scan_runs_started_idx ON lead_radar_scan_runs(started_at DESC);
CREATE INDEX lead_radar_sources_due_idx ON lead_radar_sources(enabled,last_scan_at);
CREATE INDEX lead_radar_sources_due_v3_idx ON lead_radar_sources(enabled,source_type,last_scan_at);
CREATE INDEX listing_appeals_status_idx ON listing_appeals(status,created_at);
CREATE INDEX listing_photos_visual_hash_idx ON listing_photos(visual_hash, listing_id);
CREATE UNIQUE INDEX listing_reports_member_once_idx
  ON listing_reports(listing_id, reporter_user_id) WHERE reporter_user_id IS NOT NULL;
CREATE INDEX listings_business_name_idx ON listings(business_name, city, category, created_at DESC);
CREATE INDEX listings_category_city_idx ON listings(category, city, status);
CREATE INDEX listings_category_detail_idx ON listings(category_detail,city,status);
CREATE UNIQUE INDEX listings_content_hash_active_unique
  ON listings(content_hash) WHERE content_hash IS NOT NULL AND status<>'deleted';
CREATE INDEX listings_content_hash_idx ON listings(content_hash, created_at DESC);
CREATE INDEX listings_package_status_created_idx ON listings(package_tier,status,created_at DESC);
CREATE INDEX listings_service_category_idx ON listings(service_category,city,status);
CREATE INDEX listings_status_created_idx ON listings(status, created_at DESC);
CREATE INDEX listings_user_idx ON listings(user_id, created_at DESC);
CREATE INDEX member_notifications_inbox ON member_notifications(user_id, created_at DESC);
CREATE INDEX metric_day ON listing_metrics_daily(day);
CREATE INDEX metric_expiry ON listing_metric_dedup(created_at);
CREATE INDEX metric_recent ON listing_metric_dedup(listing_id,kind,visitor_hash,created_at);
CREATE INDEX moderation_feedback_created_idx ON moderation_feedback(created_at);
CREATE INDEX outreach_draft_expiry ON outreach_drafts(updated_at);
CREATE INDEX publication_email_due_idx ON publication_email_outbox(status,next_attempt_at);
CREATE INDEX radar_buyer_contacts_lead_idx
 ON radar_buyer_contacts(lead_id,last_verified_at DESC);
CREATE UNIQUE INDEX radar_buyer_contacts_org_phone_idx
 ON radar_buyer_contacts(organization,business_phone);
CREATE INDEX radar_buyer_contacts_region_idx
 ON radar_buyer_contacts(city,district,demand_status);
CREATE INDEX radar_contact_audit_contact_idx
 ON radar_contact_audit(contact_id,created_at DESC);
CREATE INDEX site_visits_created ON site_visits(created_at);
CREATE INDEX site_visits_day ON site_visits(day);
CREATE INDEX support_tickets_created_idx ON support_tickets(status,created_at DESC);
CREATE INDEX user_attempts_ip_time_idx ON user_login_attempts(ip_hash,action,created_at);
CREATE INDEX user_sessions_expiry_idx ON user_sessions(expires_at);
CREATE INDEX user_sessions_user_idx ON user_sessions(user_id);
CREATE UNIQUE INDEX users_google_sub_unique ON users(google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX users_single_admin_idx ON users(role) WHERE role='admin';
