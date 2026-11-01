/**
 * Radar feed and publication policy for the future V167+ integration.
 * This is a library module only. Merely installing it does not change live Workers.
 * RSS access permission and republishing permission are distinct.
 */
const EXACT_FEEDS = new Map([
  ['https://www.trakyaka.org.tr/tr/34846/Ihale-Ilanlari/type/rss', 'Trakya Kalkinma Ajansi'],
  ['https://www.denizticaretodasi.org.tr/tr/rss/sirkuler', 'Deniz Ticaret Odasi'],
  ['https://www.denizticaretodasi.org.tr/tr/rss/haberler', 'Deniz Ticaret Odasi']
]);

export function inspectRadarFeedUrl(candidate) {
  if (typeof candidate !== 'string' || candidate.length > 2048) {
    return { allowed: false, reason: 'invalid_feed_url' };
  }
  let url;
  try { url = new URL(candidate); } catch { return { allowed: false, reason: 'invalid_feed_url' }; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.hash || url.search || url.pathname.includes('//')) {
    return { allowed: false, reason: 'untrusted_feed_url' };
  }
  if (!EXACT_FEEDS.has(url.href)) {
    return { allowed: false, reason: 'not_verified_publisher_feed' };
  }
  return { allowed: true, reason: 'publisher_lists_rss', publisher: EXACT_FEEDS.get(url.href),
    eligibleForReading: true, eligibleForRepublishing: false };
}
/**
 * Explicit positive licensing evidence is required; publisher RSS alone never
 * permits copying full text or publishing a mirrored customer request.
 */
export function mayAutomaticallyPublishRadarLead(source, lead, nowSeconds=Math.floor(Date.now()/1000)) {
  if (!source || !lead) return { allowed:false, reason:'missing_data' };
  if (source.enabled !== 1 || source.auto_publish_enabled !== 1) {
    return { allowed:false, reason:'feature_or_source_disabled' };
  }
  if (source.republish_attested !== 1 || !source.republish_terms_url ||
      !source.republish_checked_at || !['republish_allowed','licensed_partner'].includes(source.permission_status)) {
    return { allowed:false, reason:'republishing_rights_unverified' };
  }
  if (source.source_type !== 'rss' && source.source_type !== 'licensed_api') {
    return { allowed:false, reason:'unsupported_source_type' };
  }
  if (lead.classification !== 'relevant' || Number(lead.confidence) < .9 ||
      !['official_source','manual_reviewed'].includes(lead.verification)) {
    return { allowed:false, reason:'not_sufficiently_verified' };
  }
  if (!lead.city || !lead.service_type || !lead.source_url || !lead.public_summary) {
    return { allowed:false, reason:'essential_lead_fields_missing' };
  }
  if (!Number.isFinite(Number(lead.public_expires_at)) || Number(lead.public_expires_at) <= nowSeconds) {
    return { allowed:false, reason:'expired_or_no_expiry' };
  }
  return { allowed:true, reason:'verified_factual_summary_only' };
}
