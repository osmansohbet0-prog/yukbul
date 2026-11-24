import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as listingPage} from '../functions/ilan/[id].js';

test('an expired approved listing keeps its URL and shows renewal packages without exposing its details', async () => {
  const queries = [];
  const env = { DB: { prepare(sql) {
    queries.push(sql);
    return { bind() { return this; }, async first() {
      if (sql.includes('trial_expires_at>unixepoch()')) return null;
      if (sql.includes('MAX(COALESCE(l.trial_expires_at,0),COALESCE(l.paid_until,0))<=unixepoch()')) return { id: 'expired_123456' };
      return null;
    } };
  } } };
  const response = await listingPage({
    params: { id: 'expired_123456', slug: 'ozel-ilan-basligi' },
    request: new Request('https://yukvinc.com.tr/ilan/expired_123456/ozel-ilan-basligi/?utm_source=test'),
    env
  });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
  assert.match(html, /Bu ilanın yayın süresi doldu/);
  assert.match(html, /599 TL \/ 30 gün/);
  assert.match(html, /2\.899 TL \/ 30 gün/);
  assert.match(html, /3\.000 TL \/ 30 gün/);
  assert.match(html, /href="https:\/\/yukvinc\.com\.tr\/ilan\/expired_123456\/ozel-ilan-basligi\//);
  assert.doesNotMatch(html, /utm_source|telefon numarası|0545/);
  assert.equal(queries.length, 2);
});
