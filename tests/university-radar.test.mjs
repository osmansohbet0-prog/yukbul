import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sqliteD1} from './fixtures/sqlite-d1.mjs';
import {analyzeNotice,candidateLinks,officialUrl} from '../university/analyze.js';
import {readOfficial,scanUniversity} from '../university/crawler.js';
import {snapshot,page} from '../university/admin.js';
const now=Date.parse('2026-11-04T12:00:00+03:00')/1000;
const sample=(year=2026,extra='')=>`<h1>4/B Sözleşmeli Personel Alım İlanı</h1><p>657 sayılı kanuna göre Tıbbi Laboratuvar Teknikeri alınacaktır. ${year} KPSS P93 puanı şarttır. Son başvuru tarihi: 15.11.2026 ${extra}</p>`;
test('KPSS year is never inferred from current date or notice title',()=>{
 const old=analyzeNotice(sample(2024),{now});assert.equal(old.kpss_tag,'kpss_2024');assert.deepEqual(old.kpss_years,[2024]);
 assert.equal(analyzeNotice('<h1>2026 Sözleşmeli personel alımı</h1> KPSS P93 puanı',{now}).kpss_tag,'unknown');
 assert.equal(analyzeNotice(sample(2024,'2026 KPSS puanı da belirtilmiştir.'),{now}).kpss_tag,'mixed');
});
test('a P93 requirement for another row is not assigned to laboratory personnel',()=>{
 assert.equal(analyzeNotice(sample(),{now}).kpss_tag,'kpss_2026_unconfirmed_score');
 assert.equal(analyzeNotice('<h1>Sözleşmeli Personel Alımı</h1><p>Tıbbi Laboratuvar Teknikeri için 2026 KPSS P93 şarttır; Son başvuru: 15 Kasım 2026</p>',{now}).kpss_tag,'kpss_2026_p93');
 const multi=analyzeNotice('<h1>Sözleşmeli Personel Alımı</h1>Tıbbi Laboratuvar Teknikeri P94. Büro personeli 2026 KPSS P93.',{now});assert.notEqual(multi.kpss_tag,'kpss_2026_p93');
});
test('deadline, withdrawn notices, reserves and foundation vacancies are conservative',()=>{
 assert.equal(analyzeNotice(sample(),{now}).status,'open');
 assert.equal(analyzeNotice(sample(),{now:now+20*86400}).status,'closed');
 assert.equal(analyzeNotice(sample().replace('Alım İlanı','Alım Sonuçları — Yedek'),{now}).status,'result');
 assert.equal(analyzeNotice(sample()+' İlan iptal edilmiştir.',{now}).status,'withdrawn');
 assert.equal(analyzeNotice('<h1>İş ilanı</h1>Tıbbi Laboratuvar Teknikeri aranmaktadır. Son başvuru: 15.11.2026',{now}).status,'not_relevant');
 assert.equal(analyzeNotice(sample().replace('15.11.2026','31.02.2026'),{now}).status,'unverified');
});
test('official URL validation and feed links reject credential, foreign and insecure addresses',()=>{
 for(const u of ['http://a.edu.tr/','https://a.edu.tr.evil.com/','https://a.edu.tr:444/','https://user@a.edu.tr/','https://127.0.0.1/'])assert.equal(officialUrl(u),null);
 assert.equal(officialUrl('https://a.edu.tr/ilan?utm_source=x#foo'),'https://a.edu.tr/ilan');
 const rss='<rss><item><title>4/B personel alım ilanı</title><link>https://a.edu.tr/i</link></item><item><title>Personel alım ilanı</title><link>https://evil.gov.tr/x</link></item></rss>';
 assert.deepEqual(candidateLinks(rss,'https://a.edu.tr/duyurular').map(x=>x.url),['https://a.edu.tr/i']);
});
test('robots denial and off-publisher redirects are not bypassed',async()=>{
 let detail=false;
 await assert.rejects(readOfficial('https://a.edu.tr/private',{fetcher:async u=>{if(String(u).endsWith('robots.txt'))return new Response('User-agent: *\nDisallow: /private');detail=true;return new Response('x');}}),/robots_disallowed/);assert.equal(detail,false);
 await assert.rejects(readOfficial('https://a.edu.tr/',{fetcher:async u=>String(u).endsWith('robots.txt')?new Response('',{status:404}):new Response(null,{status:302,headers:{location:'https://evil.edu.tr/'}})}),/unsafe_redirect/);
});
function db(){const d=sqliteD1();d.sqlite.exec(readFileSync(new URL('../migrations/0016_university_radar.sql',import.meta.url),'utf8'));return d;}
const source=async d=>{await d.prepare("INSERT INTO university_catalog VALUES('u','Test Üniversitesi','Ankara','devlet','https://a.edu.tr/','https://www.yok.gov.tr/','2026-11-04')").run();await d.prepare("INSERT INTO university_sources(id,university_id,kind,url,label) VALUES('s','u','personnel','https://a.edu.tr/duyuru','Duyurular')").run();};
test('scan records official evidence, deduplicates repeated scans, expires and removes notices',async()=>{
 const d=db();await source(d);let missing=false;
 const fetcher=async url=>String(url).endsWith('robots.txt')?new Response('User-agent: *\nAllow: /',{headers:{'content-type':'text/plain'}}):String(url).endsWith('/duyuru')?new Response('<a href="/i">4/B Personel Alım İlanı</a>',{headers:{'content-type':'text/html'}}):missing?new Response('',{status:410}):new Response(sample(2024),{headers:{'content-type':'text/html'}});
 await scanUniversity({DB:d},{fetcher,now});let row=await d.prepare('SELECT * FROM university_notices').first();assert.equal(row.status,'open');assert.equal(row.kpss_tag,'kpss_2024');assert.equal(row.source_url,'https://a.edu.tr/i');
 await d.prepare('UPDATE university_sources SET next_scan_at=0').run();await scanUniversity({DB:d},{fetcher,now:now+10});assert.equal((await d.prepare('SELECT COUNT(*) AS n FROM university_notices').first()).n,1);
 let data=await snapshot(d,now+90000);assert.equal(data.items[0].status,'unverified');
 missing=true;await d.prepare('UPDATE university_sources SET next_scan_at=0').run();await scanUniversity({DB:d},{fetcher,now:now+90000});row=await d.prepare('SELECT * FROM university_notices').first();assert.equal(row.status,'removed');
 d.sqlite.close();
});
test('leased sources cannot be scanned concurrently and failed sources cannot leave jobs open',async()=>{
 const d=db();await source(d);await d.prepare('UPDATE university_sources SET lease_until=?').bind(now+300).run();assert.equal((await scanUniversity({DB:d},{now,fetcher:()=>{throw Error('should not fetch');}})).scanned,0);
 await d.prepare('UPDATE university_sources SET lease_until=0').run();await d.prepare("INSERT INTO university_notices(id,university_id,source_id,source_url,title,last_seen_at,first_seen_at,status) VALUES('n','u','s','https://a.edu.tr/i','4/B',?,?, 'open')").bind(now,now).run();
 await scanUniversity({DB:d},{now,fetcher:async()=>new Response('',{status:403})});assert.equal((await d.prepare('SELECT status FROM university_notices').first()).status,'unverified');assert.equal((await d.prepare('SELECT health FROM university_sources').first()).health,'blocked');d.sqlite.close();
});
test('catalog and seeds cover the same official universities without claiming bootstrap health as runtime success',async()=>{
 const d=db();d.sqlite.exec(readFileSync(new URL('../migrations/0017_university_catalog_seed.sql',import.meta.url),'utf8'));
 const data=await snapshot(d,now);const catalog=JSON.parse(readFileSync(new URL('../university/catalog.json',import.meta.url),'utf8'));
 assert.equal(data.universities.length,catalog.universities.length);assert.ok(data.universities.length>=202);assert.equal(data.summary.with_healthy_sources,0);
 assert.equal(data.sources.filter(s=>s.kind==='portal').length,2);assert.ok(data.sources.filter(s=>s.kind==='portal').every(s=>s.enabled===0));
 assert.ok(page(data).includes('PDF ekleri'));assert.ok(!page({...data,items:[{...analyzeNotice(sample(),{now}),id:'evil',title:'<script>alert(1)</script>',source_url:'javascript:alert(1)',evidence:[],links:[],kpss_years:[],score_types:[]}]}).includes('<script>'));d.sqlite.close();
});
test('production baseline has only adapter exports appended to the verified live bytes',()=>{
 const source=readFileSync(new URL('../src/production-baseline.mjs',import.meta.url),'utf8');const original=source.split('\n// Adapter exports only;')[0].trimEnd()+'\n';
 assert.equal(createHash('sha256').update(original).digest('hex'),'52cf5d7d156dead58495df2f1979f5697201460219d277e40919252370d92934');
});
