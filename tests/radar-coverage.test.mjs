import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCoverageMatrix,SIGNAL_LAYERS} from '../functions/_lib/radar-coverage.js';
const now=Date.parse('2026-11-02T10:00:00+03:00'),epoch=Math.floor(now/1000);
const source={enabled:1,terms_attested:1,access_method:'rss',permission_status:'publisher_rss',source_category:'public_tender',feed_url:'https://kurum.gov.tr/rss',province_codes_json:'[41,41]',last_success_at:epoch-10,consecutive_errors:0};
test('coverage includes all provinces and separates catalog links from verified working sources',()=>{
 const result=buildCoverageMatrix([source],{now});assert.equal(result.rows.length,81);assert.equal(result.summary.districts,973);assert.equal(result.summary.catalogLinks,929);
 const kocaeli=result.rows.find(x=>x.provinceCode===41);assert.equal(kocaeli.registered,1);assert.equal(kocaeli.working,1);assert.equal(kocaeli.publicationReady,0);
 assert.equal(result.rows.find(x=>x.provinceCode===34).working,0);assert.equal(result.summary.provincesWithoutWorkingReader,80);
});
test('source permission and publication rights are independent and scope is never invented',()=>{
 const result=buildCoverageMatrix([{...source,enabled:0},{...source,province_codes_json:'not JSON'},{...source,province_codes_json:'[]'}],{now});assert.equal(result.rows.find(x=>x.provinceCode===41).working,0);assert.equal(result.summary.unscopedSources,2);
 const licensed={...source,republish_attested:1,republish_checked_at:epoch-10,republish_terms_url:'https://kurum.gov.tr/terms'};
 assert.equal(buildCoverageMatrix([licensed],{now}).rows.find(x=>x.provinceCode===41).publicationReady,1);
});
test('project, recruitment, company discovery and advertisements cannot become public demand candidates',()=>{
 for(const id of ['project_indicator','recruitment','company_indicator','supply'])assert.equal(SIGNAL_LAYERS.find(x=>x.id===id).publicDemandCandidate,false);
});
