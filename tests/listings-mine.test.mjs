import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/listings/mine.js';

test('account expiry is based on the later trial or paid-until date', async () => {
  let listingQuery = '';
  const DB = { prepare(sql) {
    return {
      bind() { return this; },
      async first() { return sql.includes('FROM user_sessions') ? { id: 'member_123456', email: 'member@example.test', role: 'member' } : null; },
      async all() { listingQuery = sql; return { results: [] }; }
    };
  } };
  const request = new Request('https://yukvinc.com.tr/api/listings/mine', { headers: { cookie: '__Host-yv_member=session-token' } });
  const response = await onRequestGet({ request, env: { DB } });
  assert.equal(response.status, 200);
  assert.match(listingQuery, /MAX\(COALESCE\(trial_expires_at,0\),COALESCE\(paid_until,0\)\)<=unixepoch\(\)/);
  assert.doesNotMatch(listingQuery, /trial_expires_at IS NULL OR/);
});
