import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGoogleAlertsFeedUrl, parseGoogleAlertsAtom, fetchGoogleAlertsCandidates } from '../functions/_lib/radar-google-alerts.js';
const sample = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><id>123</id><title>Gebze\'de vinç &amp; manlift lazım</title><link href="https://example.com/ihale/1"/><published>2026-11-01T11:00:00Z</published></entry></feed>';
const now = new Date('2026-11-01T15:00:00Z');
test('official RSS feed address accepted', () => {
  assert.equal(validateGoogleAlertsFeedUrl('https://www.google.com/alerts/feeds/123/abc').ok, true);
});
test('untrusted URLs blocked (SSRF, redirects, credentials)', () => {
  for (const u of ['http://www.google.com/alerts/feeds/1/2','https://google.com/alerts/feeds/1/2', 'https://www.google.com.evil.org/alerts/feeds/1/2', 'https://www.google.com@evil.org/alerts/feeds/1/2','https://www.google.com/redirect?url=https://evil.org','https://127.0.0.1/alerts/feeds/1/2','https://www.google.com/alerts/feeds/1/2?url=foo'])
    assert.equal(validateGoogleAlertsFeedUrl(u).ok, false, u);
});
test('parses Atom metadata into pending candidates, not published jobs', () => {
  assert.deepEqual(parseGoogleAlertsAtom(sample, { now })[0], {
    id: '123', title: "Gebze'de vinç & manlift lazım", sourceUrl: 'https://example.com/ihale/1',
    publishedAt: '2026-11-01T11:00:00.000Z', status: 'needs_review', publicationRights: 'unverified'
  });
});
test('rejects oversized feeds and stale results', () => {
  assert.throws(() => parseGoogleAlertsAtom('a'.repeat(1000001),{ now }));
  assert.equal(parseGoogleAlertsAtom(sample.replace('2026-11-01T11:00:00Z','2026-01-01T11:00:00Z'), { now }).length,0);
});
test('accepts a genuine successful XML response', async () => {
  const result = await fetchGoogleAlertsCandidates('https://www.google.com/alerts/feeds/123/abc', {
    fetchImpl: async () => new Response(sample, { headers: {'Content-Type': 'application/atom+xml'} })
  });
  assert.equal(result.length, 1);
});
test('rejects redirect response (not following external hosts)', async () => {
  await assert.rejects(fetchGoogleAlertsCandidates('https://www.google.com/alerts/feeds/123/abc', {
    fetchImpl: async (url, options) => {assert.equal(options.redirect, 'manual'); return new Response('', {status:302,headers:{Location:'https://evil.org'}});}
  }), /rss_http_302/);
});
