import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const assets = { fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`) };

test('worker routes static assets through the assets binding', async () => {
  const response = await worker.fetch(new Request('https://yukvinc.com.tr/assets/site.css'), { ASSETS: assets });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'asset:/assets/site.css');
});

test('worker serves the account and admin membership interface without replacing site assets', async () => {
  const response = await worker.fetch(new Request('https://yukvinc.com.tr/assets/membership-expiry-ui.js?v=20261124'), { ASSETS: assets });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/javascript/);
  const script = await response.text();
  assert.match(script, /Üyelik süresi dolanlar/);
  assert.match(script, /renewal_payment_request/);
});

test('worker dispatches public API handlers instead of Pages Functions', async () => {
  const response = await worker.fetch(new Request('https://yukvinc.com.tr/api/public-settings'), { ASSETS: assets });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).settings.brand_name, 'Yük Vinç');
});

test('worker does not shadow the static /mine listing route with the dynamic id route', async () => {
  const response = await worker.fetch(new Request('https://yukvinc.com.tr/api/listings/mine'), { ASSETS: assets });
  assert.notEqual(response.status, 405);
});

test('www host redirects to apex and keeps path and query', async () => {
  const request = new Request('https://www.yukvinc.com.tr/ilan-ver/?from=www');
  const response = await worker.fetch(request, { ASSETS: assets });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), 'https://yukvinc.com.tr/ilan-ver/?from=www');
});

test('worker adds security headers and keeps API responses out of search indexes', async () => {
  const response = await worker.fetch(new Request('https://yukvinc.com.tr/api/public-settings'), { ASSETS: assets });
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
});
