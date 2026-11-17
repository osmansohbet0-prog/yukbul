import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestGet} from '../functions/api/admin-radar-dashboard.js';

test('radar dashboard endpoint refuses unauthenticated requests', async () => {
  const request = new Request('https://yukvinc.com.tr/api/admin-radar-dashboard');
  const response = await onRequestGet({request, env:{DB:{},ADMIN_EMAIL:'admin@example.com'}});
  assert.equal(response.status,401);
  assert.match(response.headers.get('content-type')||'',/application\/json/);
});

test('radar interface does not disclose contacts or publish automatically', () => {
  const page=readFileSync(new URL('../public/admin/radar/index.html',import.meta.url),'utf8');
  const js=readFileSync(new URL('../public/assets/radar-simple.js',import.meta.url),'utf8');
  const backend=readFileSync(new URL('../functions/api/admin-radar-dashboard.js',import.meta.url),'utf8');
  assert.match(page,/data-radar-view="opportunities"/);
  assert.match(page,/data-radar-view="sources"/);
  assert.match(page,/data-radar-view="history"/);
  assert.doesNotMatch(page,/<script(?![^>]*src=)/i);
  assert.doesNotMatch(backend,/contact_phone|business_email|UPDATE lead_radar|DELETE FROM lead_radar/i);
  assert.match(backend,/requireAdmin\(context\)/);
  assert.match(js,/safeText\(/);
  assert.doesNotMatch(js, /method:\s*['"]POST['"]/);
});
