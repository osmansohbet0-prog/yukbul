import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRadarFeedUrl,mayAutomaticallyPublishRadarLead} from '../functions/_lib/radar-feed-policy.js';
test('Publisher RSS exact URLs are readable but not automatically republishable',()=>{
 const out=inspectRadarFeedUrl('https://www.denizticaretodasi.org.tr/tr/rss/sirkuler');
 assert.equal(out.allowed,true);assert.equal(out.eligibleForRepublishing,false);
});
test('No redirects, forged host, auth, query or HTTP URLs are accepted',()=>{
 for(const url of [
  'https://www.denizticaretodasi.org.tr.evil.com/tr/rss/sirkuler',
  'http://www.denizticaretodasi.org.tr/tr/rss/sirkuler',
  'https://www.denizticaretodasi.org.tr/tr/rss/sirkuler?x=1',
  'https://bad@www.denizticaretodasi.org.tr/tr/rss/sirkuler',
  'https://127.0.0.1/tr/rss/sirkuler',
  'https://ihale.tobb.org.tr/yeni/RssIhale.php'
 ]) assert.equal(inspectRadarFeedUrl(url).allowed,false,url);
});
const now=1793540000;
const source={enabled:1,auto_publish_enabled:1,republish_attested:1,republish_terms_url:'https://publisher.example/license',republish_checked_at:1793500000,permission_status:'republish_allowed',source_type:'rss'};
const lead={classification:'relevant',confidence:.97,verification:'official_source',city:'Konya',service_type:'crane',source_url:'https://publisher.example/lead',public_summary:'Kiralama ihalesi',public_expires_at:now+3600};
test('No automatic publication for just RSS, missing rights or inactive source',()=>{
 for(const patch of [{republish_attested:0},{republish_terms_url:null},{permission_status:'publisher_rss'},{enabled:0},{auto_publish_enabled:0}])
  assert.equal(mayAutomaticallyPublishRadarLead({...source,...patch},lead,now).allowed,false);
});
test('Rejects AI hallucination, unverified source, missing expiry and stale jobs',()=>{
 for(const patch of [{classification:'review'},{confidence:.6},{verification:'unverified'},{city:''},{public_expires_at:null},{public_expires_at:now-1}])
  assert.equal(mayAutomaticallyPublishRadarLead(source,{...lead,...patch},now).allowed,false);
});
test('Explicitly licensed timely high-confidence factual summary eligible',()=>{
 assert.equal(mayAutomaticallyPublishRadarLead(source,lead,now).allowed,true);
});
