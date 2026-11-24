import test from 'node:test';
import assert from 'node:assert/strict';
import { contactPrivacyUi, redactPublicListingContacts, stripPublicListingPhones } from '../src/contact-privacy.js';

test('public listing payloads expose only whether a contact button exists', () => {
  const payload = { items: [{ id: 'listing_123456', contact_phone: '+90 532 123 45 67' }, { id: 'listing_abcdef', contact_phone: '' }] };
  const result = stripPublicListingPhones(payload);
  assert.equal(result.changed, true);
  assert.deepEqual(payload.items.map(item => item.has_contact_phone), [true, false]);
  assert.equal('contact_phone' in payload.items[0], false);
  assert.equal(JSON.stringify(payload).includes('5321234567'), false);
});

test('public JSON responses remove listing numbers and disable caching', async () => {
  const response = new Response(JSON.stringify({ items: [{ id: 'listing_123456', contact_phone: '05321234567' }] }), {
    headers: { 'content-type': 'application/json; charset=utf-8', etag: 'old', 'cache-control': 'public, max-age=3600' }
  });
  const sanitized = await redactPublicListingContacts(response);
  const payload = await sanitized.json();
  assert.deepEqual(payload.items[0], { id: 'listing_123456', has_contact_phone: true });
  assert.equal(sanitized.headers.get('cache-control'), 'no-store');
  assert.equal(sanitized.headers.get('etag'), null);
});

test('browser contact links route through listing id without carrying a phone number', () => {
  assert.match(contactPrivacyUi, /\?contact=\s*\x27\s*\+/);
  assert.match(contactPrivacyUi, /data-contact-route/);
  assert.doesNotMatch(contactPrivacyUi, /href\s*=\s*['"]tel:/);
});
