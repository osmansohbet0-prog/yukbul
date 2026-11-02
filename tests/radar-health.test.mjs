import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRadarHealth} from '../functions/_lib/radar-health.js';
const now=Date.parse('2026-11-02T10:00:00+03:00'),epoch=Math.floor(now/1000);
const source={id:'source',enabled:1,terms_attested:1,access_method:'rss',permission_status:'publisher_rss',source_category:'public_tender',feed_url:'https://kurum.gov.tr/rss',province_codes_json:'[41]',last_success_at:epoch-100,consecutive_errors:0};
test('catalog, enabled, working and publication-ready sources remain distinct',()=>{
 const h=buildRadarHealth([source,{...source,id:'passive',enabled:0},{...source,id:'broken',consecutive_errors:1}],[],{now});
 assert.deepEqual(h.counts,{registered:3,enabled:2,working:1,publicationReady:0,reviewCandidates:0,freshCandidates:0});assert.equal(h.focus.working,1);
 assert.ok(h.issues.some(x=>x.code==='publication_rights_missing'));assert.ok(h.issues.some(x=>x.code==='source_errors'));
});
test('valid rights require a recent successful scan and matching publisher',()=>{
 const rights={...source,republish_attested:1,republish_checked_at:epoch-100,republish_terms_url:'https://kurum.gov.tr/terms'};
 assert.equal(buildRadarHealth([rights],[],{now}).counts.publicationReady,1);
 assert.equal(buildRadarHealth([{...rights,last_success_at:epoch-604801}],[],{now}).counts.publicationReady,0);
 assert.equal(buildRadarHealth([{...rights,republish_terms_url:'https://other.gov.tr/terms'}],[],{now}).counts.publicationReady,0);
});
test('a newly inserted lead with an old source date never counts as fresh',()=>{
 const item={status:'review',classification:'relevant',created_at:epoch,published_at:new Date(now).toISOString()};
 assert.equal(buildRadarHealth([], [item],{now}).counts.freshCandidates,0);
 const draft={...item,ai_draft:{evidence_json:JSON.stringify({sourceChecked:true,authorPublishedAt:new Date(now-3600000).toISOString()})}};
 assert.equal(buildRadarHealth([], [draft],{now}).counts.freshCandidates,1);
 assert.equal(buildRadarHealth([], [{...draft,ai_draft:{evidence_json:JSON.stringify({sourceChecked:true,authorPublishedAt:'2020-01-01T00:00:00Z'})}}],{now}).counts.freshCandidates,0);
});
