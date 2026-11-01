/**
 * YükVinç Radar — Google Alerts adapter (staging-only, not wired to routes).
 * This module never creates Alerts or accesses a Google account.
 */
const MAX_FEED_BYTES = 1_000_000;
const MAX_ITEMS = 80;
const MAX_AGE_DAYS = 90;

export function validateGoogleAlertsFeedUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return { ok: false, reason: 'invalid_url' };
  let url;
  try { url = new URL(value.trim()); } catch { return { ok: false, reason: 'invalid_url' }; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.google.com' ||
      url.port || url.username || url.password || url.search || url.hash ||
      !/^\/alerts\/feeds\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) {
    return { ok: false, reason: 'not_a_google_alerts_rss_url' };
  }
  return { ok: true, normalizedUrl: url.href };
}

function decodeXmlText(value) {
  return String(value || '').replace(/&#(\d+);|&#x([0-9a-f]+);|&(amp|lt|gt|quot|apos);/gi,
    (_, dec, hex, named) => {
      if (named) return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase()];
      const code = Number.parseInt(dec || hex, dec ? 10 : 16);
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    });
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  if (!match) return '';
  return decodeXmlText(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** The feed is Atom. Returns candidate metadata only; never publishes automatically. */
export function parseGoogleAlertsAtom(xml, { now = new Date() } = {}) {
  if (typeof xml !== 'string' || xml.length > MAX_FEED_BYTES || !/<feed(?:\s|>)/i.test(xml)) {
    throw new Error('invalid_or_oversized_feed');
  }
  const entries = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
  const candidates = [];
  const nowMs = new Date(now).getTime();
  for (const entry of entries.slice(0, MAX_ITEMS)) {
    const id = extractTag(entry, 'id');
    const title = extractTag(entry, 'title').slice(0, 350);
    const published = extractTag(entry, 'published') || extractTag(entry, 'updated');
    const rawLink = entry.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?\s*>/i)?.[1];
    let sourceUrl;
    try {
      const u = new URL(decodeXmlText(rawLink));
      if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
      sourceUrl = u.href;
    } catch { continue; }
    const publishedMs = Date.parse(published);
    if (!title || !Number.isFinite(publishedMs) || publishedMs > nowMs + 300000 ||
        nowMs - publishedMs > MAX_AGE_DAYS * 86400000) continue;
    candidates.push({ id: id.slice(0, 512), title, sourceUrl, publishedAt: new Date(publishedMs).toISOString(), status: 'needs_review', publicationRights: 'unverified' });
  }
  return candidates;
}

export async function fetchGoogleAlertsCandidates(feedUrl, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  const check = validateGoogleAlertsFeedUrl(feedUrl);
  if (!check.ok) throw new Error(check.reason);
  const response = await fetchImpl(check.normalizedUrl, {
    method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/atom+xml,application/xml;q=0.9' }
  });
  if (response.status !== 200) throw new Error('rss_http_' + response.status);
  const type = response.headers.get('content-type') || '';
  if (!/(?:atom\+xml|(?:application|text)\/xml)/i.test(type)) throw new Error('unexpected_content_type');
  const len = Number(response.headers.get('content-length') || 0);
  if (len > MAX_FEED_BYTES) throw new Error('feed_too_large');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('empty_feed');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FEED_BYTES) throw new Error('feed_too_large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  return parseGoogleAlertsAtom(new TextDecoder('utf-8').decode(joined));
}
