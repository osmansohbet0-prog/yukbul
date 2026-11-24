import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePublicationExpiry } from '../functions/_lib/listing-expiry.js';
test('extends an expired listing from now rather than its old expiry',()=>assert.equal(calculatePublicationExpiry({trialExpiresAt:100,paidUntil:200,days:30,now:1000}),1000+30*86400));
test('reduces an active listing from the effective later expiry',()=>assert.equal(calculatePublicationExpiry({trialExpiresAt:1200000,paidUntil:2000000,days:-7,now:1000000}),2000000-7*86400));
test('rejects zero, fractional and excessive changes',()=>{for(const days of [0,1.5,3651,-3651])assert.throws(()=>calculatePublicationExpiry({trialExpiresAt:1000,paidUntil:0,days,now:500}));});
