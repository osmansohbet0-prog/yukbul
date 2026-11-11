-- YükVinç staging ONLY. Never apply automatically to production.
-- Recreates radar structures without copying customer, user, lead or source data.

CREATE TABLE IF NOT EXISTS lead_radar_provinces (
  province_code INTEGER PRIMARY KEY,
  province_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lead_radar_sources (
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

CREATE TABLE IF NOT EXISTS lead_radar_leads (
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

CREATE TABLE IF NOT EXISTS lead_radar_evidence (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES lead_radar_leads(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES lead_radar_sources(id),
  source_url TEXT NOT NULL UNIQUE,
  source_title TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL DEFAULT(unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT(unixepoch())
);

CREATE TABLE IF NOT EXISTS lead_radar_scan_jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')), requested_by TEXT, created_at INTEGER NOT NULL DEFAULT(unixepoch()), started_at INTEGER, finished_at INTEGER, lease_until INTEGER NOT NULL DEFAULT 0, source_cursor TEXT NOT NULL DEFAULT '', source_total INTEGER NOT NULL DEFAULT 0, sources_scanned INTEGER NOT NULL DEFAULT 0, items_seen INTEGER NOT NULL DEFAULT 0, candidates_added INTEGER NOT NULL DEFAULT 0, duplicates_linked INTEGER NOT NULL DEFAULT 0, items_rejected INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0, last_error TEXT);

CREATE TABLE IF NOT EXISTS lead_radar_scan_runs (
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

CREATE INDEX IF NOT EXISTS lead_radar_sources_due_idx ON lead_radar_sources(enabled,last_scan_at);
CREATE INDEX IF NOT EXISTS lead_radar_leads_status_idx ON lead_radar_leads(status,created_at DESC);
CREATE INDEX IF NOT EXISTS lead_radar_leads_location_idx ON lead_radar_leads(city,service_type);
CREATE INDEX IF NOT EXISTS lead_radar_public_idx ON lead_radar_leads(public_at,public_expires_at);
CREATE INDEX IF NOT EXISTS lead_radar_sources_due_v3_idx ON lead_radar_sources(enabled,source_type,last_scan_at);
CREATE INDEX IF NOT EXISTS lead_radar_scan_runs_started_idx ON lead_radar_scan_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS lead_radar_evidence_lead_idx ON lead_radar_evidence(lead_id,last_seen_at DESC);
CREATE INDEX IF NOT EXISTS lead_radar_jobs_queue_idx ON lead_radar_scan_jobs(status,created_at);

CREATE TABLE IF NOT EXISTS radar_search_profiles(province_code INTEGER PRIMARY KEY REFERENCES lead_radar_provinces(province_code),priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 3),enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),scan_interval_seconds INTEGER NOT NULL CHECK(scan_interval_seconds BETWEEN 300 AND 604800),last_scanned_at INTEGER,next_scan_at INTEGER,updated_at INTEGER NOT NULL DEFAULT(unixepoch()));
CREATE INDEX IF NOT EXISTS radar_search_profiles_priority_idx ON radar_search_profiles(enabled,priority,next_scan_at);
CREATE TABLE IF NOT EXISTS radar_keyword_rules(id TEXT PRIMARY KEY,category TEXT NOT NULL CHECK(category IN('crane','basket','tow','machine','lift')),phrase TEXT NOT NULL,normalized_phrase TEXT NOT NULL,rule_type TEXT NOT NULL DEFAULT 'include' CHECK(rule_type IN('include','exclude')),enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),created_at INTEGER NOT NULL DEFAULT(unixepoch()),UNIQUE(category,normalized_phrase,rule_type));
CREATE INDEX IF NOT EXISTS radar_keyword_rules_active_idx ON radar_keyword_rules(category,rule_type,enabled);

INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (1,'Adana');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (2,'Adıyaman');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (3,'Afyonkarahisar');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (4,'Ağrı');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (5,'Amasya');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (6,'Ankara');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (7,'Antalya');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (8,'Artvin');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (9,'Aydın');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (10,'Balıkesir');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (11,'Bilecik');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (12,'Bingöl');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (13,'Bitlis');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (14,'Bolu');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (15,'Burdur');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (16,'Bursa');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (17,'Çanakkale');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (18,'Çankırı');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (19,'Çorum');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (20,'Denizli');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (21,'Diyarbakır');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (22,'Edirne');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (23,'Elazığ');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (24,'Erzincan');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (25,'Erzurum');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (26,'Eskişehir');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (27,'Gaziantep');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (28,'Giresun');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (29,'Gümüşhane');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (30,'Hakkari');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (31,'Hatay');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (32,'Isparta');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (33,'Mersin');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (34,'İstanbul');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (35,'İzmir');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (36,'Kars');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (37,'Kastamonu');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (38,'Kayseri');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (39,'Kırklareli');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (40,'Kırşehir');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (41,'Kocaeli');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (42,'Konya');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (43,'Kütahya');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (44,'Malatya');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (45,'Manisa');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (46,'Kahramanmaraş');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (47,'Mardin');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (48,'Muğla');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (49,'Muş');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (50,'Nevşehir');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (51,'Niğde');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (52,'Ordu');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (53,'Rize');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (54,'Sakarya');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (55,'Samsun');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (56,'Siirt');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (57,'Sinop');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (58,'Sivas');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (59,'Tekirdağ');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (60,'Tokat');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (61,'Trabzon');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (62,'Tunceli');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (63,'Şanlıurfa');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (64,'Uşak');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (65,'Van');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (66,'Yozgat');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (67,'Zonguldak');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (68,'Aksaray');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (69,'Bayburt');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (70,'Karaman');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (71,'Kırıkkale');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (72,'Batman');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (73,'Şırnak');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (74,'Bartın');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (75,'Ardahan');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (76,'Iğdır');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (77,'Yalova');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (78,'Karabük');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (79,'Kilis');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (80,'Osmaniye');
INSERT OR IGNORE INTO lead_radar_provinces(province_code,province_name) VALUES (81,'Düzce');

INSERT OR IGNORE INTO radar_search_profiles(province_code,priority,scan_interval_seconds) SELECT province_code,CASE WHEN province_code IN(6,16,34,35,41,42) THEN 1 WHEN province_code IN(1,7,27,33,38,54,59) THEN 2 ELSE 3 END,CASE WHEN province_code IN(6,16,34,35,41,42) THEN 1800 WHEN province_code IN(1,7,27,33,38,54,59) THEN 3600 ELSE 14400 END FROM lead_radar_provinces;

INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('basket:eklemli_platform_kiralama','basket','eklemli platform kiralama','eklemli platform kiralama');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('basket:makasli_platform_ihtiyaci','basket','makaslı platform ihtiyacı','makasli platform ihtiyaci');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('basket:manlift_araniyor','basket','manlift aranıyor','manlift araniyor');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('basket:manlift_lazim','basket','manlift lazım','manlift lazim');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('basket:personel_yukseltici_platform_ihtiyaci','basket','personel yükseltici platform ihtiyacı','personel yukseltici platform ihtiyaci');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('basket:yuksekte_calisma_platformu_hizmet_alimi','basket','yüksekte çalışma platformu hizmet alımı','yuksekte calisma platformu hizmet alimi');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('crane:agir_yuk_kaldirma_hizmet_alimi','crane','ağır yük kaldırma hizmet alımı','agir yuk kaldirma hizmet alimi');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('crane:crane_rental_tender','crane','crane rental tender','crane rental tender');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('crane:hiyap_araniyor','crane','hiyap aranıyor','hiyap araniyor');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('crane:mobil_vinc_hizmet_alimi','crane','mobil vinç hizmet alımı','mobil vinc hizmet alimi');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('crane:sepetli_vinc_lazim','crane','sepetli vinç lazım','sepetli vinc lazim');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('crane:vinc_araniyor','crane','vinç aranıyor','vinc araniyor');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('crane:vinc_kiralanacaktir','crane','vinç kiralanacaktır','vinc kiralanacaktir');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('crane:vinc_lazim','crane','vinç lazım','vinc lazim');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('lift:dis_cephe_asansoru_kiralama','lift','dış cephe asansörü kiralama','dis cephe asansoru kiralama');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('lift:esya_asansoru_lazim','lift','eşya asansörü lazım','esya asansoru lazim');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('lift:mobil_asansor_kiralama','lift','mobil asansör kiralama','mobil asansor kiralama');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('lift:nakliyat_asansoru_araniyor','lift','nakliyat asansörü aranıyor','nakliyat asansoru araniyor');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('lift:tasima_asansoru_ihtiyaci','lift','taşıma asansörü ihtiyacı','tasima asansoru ihtiyaci');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('machine:ekskavator_kiralanacaktir','machine','ekskavatör kiralanacaktır','ekskavator kiralanacaktir');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('machine:forklift_kiralama_ihalesi','machine','forklift kiralama ihalesi','forklift kiralama ihalesi');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('machine:forklift_lazim','machine','forklift lazım','forklift lazim');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('machine:is_makinesi_hizmet_alimi','machine','iş makinesi hizmet alımı','is makinesi hizmet alimi');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('machine:kepce_araniyor','machine','kepçe aranıyor','kepce araniyor');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('machine:operatorlu_is_makinesi_kiralama','machine','operatörlü iş makinesi kiralama','operatorlu is makinesi kiralama');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('tow:agir_vasita_lastik_hizmeti','tow','ağır vasıta lastik hizmeti','agir vasita lastik hizmeti');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('tow:kamyon_lastik_tamiri','tow','kamyon lastik tamiri','kamyon lastik tamiri');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('tow:mobil_lastikci_araniyor','tow','mobil lastikçi aranıyor','mobil lastikci araniyor');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('tow:tir_lastikci_lazim','tow','tır lastikçi lazım','tir lastikci lazim');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('tow:yerinde_lastik_degisimi','tow','yerinde lastik değişimi','yerinde lastik degisimi');
INSERT OR IGNORE INTO radar_keyword_rules(id,category,phrase,normalized_phrase) VALUES ('tow:yol_yardim_araniyor','tow','yol yardım aranıyor','yol yardim araniyor');
