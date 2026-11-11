-- YükVinç Radar CRM: public, source-backed business contacts for an admin-only view.
-- Additive migration. Does not publish a job or expose contact data in public APIs.
CREATE TABLE IF NOT EXISTS radar_buyer_contacts (
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
 updated_at INTEGER NOT NULL DEFAULT(unixepoch()),
 CHECK(business_phone IS NOT NULL OR business_email IS NOT NULL OR contact_page_url IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS radar_buyer_contacts_org_phone_idx
 ON radar_buyer_contacts(organization,business_phone);
CREATE INDEX IF NOT EXISTS radar_buyer_contacts_lead_idx
 ON radar_buyer_contacts(lead_id,last_verified_at DESC);
CREATE INDEX IF NOT EXISTS radar_buyer_contacts_region_idx
 ON radar_buyer_contacts(city,district,demand_status);
CREATE TABLE IF NOT EXISTS radar_contact_audit (
 id TEXT PRIMARY KEY,
 contact_id TEXT NOT NULL REFERENCES radar_buyer_contacts(id) ON DELETE CASCADE,
 actor TEXT NOT NULL,
 event TEXT NOT NULL CHECK(event IN ('contact_added','verified','contacted','follow_up','opt_out','updated')),
 details TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX IF NOT EXISTS radar_contact_audit_contact_idx
 ON radar_contact_audit(contact_id,created_at DESC);
