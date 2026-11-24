import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { membershipExpiryUi } from '../src/membership-expiry-ui.js';

test('membership UI script parses and exposes the three 30-day plans', () => {
  assert.doesNotThrow(() => new Function(membershipExpiryUi));
  assert.match(membershipExpiryUi, /Standart · 599 TL \/ 30 gün/);
  assert.match(membershipExpiryUi, /Öne Çıkan · 2.899 TL \/ 30 gün/);
  assert.match(membershipExpiryUi, /Premium · 3.000 TL \/ 30 gün/);
});

test('renewal only sends a manual payment check and never enables a listing automatically', () => {
  assert.match(membershipExpiryUi, /payment_declared: form\.elements\.payment_declared\.checked/);
  assert.match(membershipExpiryUi, /havale doğrulandıktan sonra uzatılır/);
  assert.match(membershipExpiryUi, /Google sıralaması garanti edilmez/);
});

test('admin expiry badge and per-listing extension are present', () => {
  assert.match(membershipExpiryUi, /membership-expired-count/);
  assert.match(membershipExpiryUi, /data-membership-extension/);
  assert.match(membershipExpiryUi, /action: 'extend_days'/);
});

test('admin can open a collapsed extension control on each member listing without changing existing layout', () => {
  const adminScript = readFileSync(new URL('../public/assets/admin.js', import.meta.url), 'utf8');
  assert.match(adminScript, /data-membership-owner=/);
  assert.match(membershipExpiryUi, /#listing-admin-list \.listing-admin-row, #listing-check-list \.listing-admin-row/);
  assert.match(membershipExpiryUi, /ownerRole === 'admin'/);
  assert.match(membershipExpiryUi, /category === 'operator'/);
  assert.match(membershipExpiryUi, /<summary>Üyelik süresini yönet<\/summary>/);
});
