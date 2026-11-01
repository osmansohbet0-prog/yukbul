import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../functions/api/admin-lead-radar.js';
import { scanLeadRadar, enqueueLeadRadarScan, processLeadRadarQueue } from '../functions/_lib/lead-radar.js';
import { digest } from '../functions/_lib/core.js';

const sql=new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,email_norm TEXT,role TEXT,active INTEGER);CREATE TABLE admin_sessions(token_hash TEXT,user_id TEXT,expires_at INTEGER);CREATE TABLE user_sessions(token_hash TEXT,user_id TEXT,expires_at INTEGER);CREATE TABLE listings(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,city TEXT,district TEXT,status TEXT,member_paused_at INTEGER,service_category TEXT,category_detail TEXT,category TEXT,trial_expires_at INTEGER,paid_until INTEGER,updated_at INTEGER);CREATE TABLE listing_directory(listing_id TEXT,source TEXT);CREATE TABLE user_login_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT,ip_hash TEXT NOT NULL,action TEXT NOT NULL,created_at INTEGER NOT NULL DEFAULT(unixepoch()));`);
sql.exec(readFileSync(new URL('../migrations/0021_job_board.sql',import.meta.url),'utf8'));
sql.exec(readFileSync(new URL('../migrations/0022_lead_radar.sql',import.meta.url),'utf8'));
sql.exec(readFileSync(new URL('../migrations/0023_job_radar_publish_and_quota.sql',import.meta.url),'utf8'));
sql.exec(readFileSync(new URL('../migrations/0024_lead_radar_v3.sql',import.meta.url),'utf8'));
sql.exec(readFileSync(new URL('../migrations/0025_lead_radar_queue_and_rights.sql',import.meta.url),'utf8'));
sql.exec(readFileSync(new URL('../migrations/0027_radar_ai_review.sql',import.meta.url),'utf8'));
sql.exec(readFileSync(new URL('../staging/sql/004_radar_buyer_contacts.sql',import.meta.url),'utf8'));
sql.exec('CREATE TABLE ai_model_budget(day TEXT NOT NULL,actor TEXT NOT NULL,calls INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,actor))');
const DB={async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}},prepare(q){let v=[];return{bind(...x){v=x;return this},async first(){return sql.prepare(q).get(...v)||null},async all(){return{results:sql.prepare(q).all(...v)}},async run(){const r=sql.prepare(q).run(...v);return{meta:{changes:Number(r.changes)}}}}}};
const token='lead-radar-test-session';
sql.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('admin','owner@example.org','owner@example.org','admin',1);
sql.prepare('INSERT INTO admin_sessions VALUES(?,?,?)').run(await digest(token),'admin',Math.floor(Date.now()/1000)+3600);
const env={DB,ADMIN_EMAIL:'owner@example.org',AI_ENABLED:'false'};
function request(method='GET',body){return new Request('https://yukvinc.com.tr/api/admin-lead-radar',{method,headers:{cookie:'__Host-yv_admin='+token,origin:'https://yukvinc.com.tr','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})}

test('seeded real-source notice is visible but remains human-review only',async()=>{
 const r=await api.onRequestGet({request:request(),env});assert.equal(r.status,200);const d=await r.json();assert.equal(d.items.length,1);assert.equal(d.items[0].source_url,'https://anfa.com.tr/2026/10/19/4-kalem-kamyon-kamyonet-ve-vinc-kiralama-hizmeti-alimi-soforsuz-yakitsiz/');assert.equal(d.items[0].status,'review');assert.equal(d.items[0].contact_status,'draft_ready');
});
test('V3 reports 81 provinces but counts a permitted RSS only after a recent successful scan',async()=>{
 const r=await api.onRequestGet({request:request(),env});assert.equal(r.status,200);const d=await r.json();assert.equal(d.provinces.length,81);assert.equal(d.summary.coveredProvinces,0);assert.equal(d.provinces.find(x=>x.name==='Eskişehir').active_sources,0);assert.equal(d.provinces.find(x=>x.name==='Ankara').active_sources,0);assert.equal(d.sources.find(x=>x.id==='eskisehir-bb-rss-notices').permission_status,'publisher_rss');assert.equal(d.sources.find(x=>x.id==='eskisehir-bb-rss-notices').auto_publish_enabled,0);
});
test('approved public RSS is scanned, rules reject noise before AI, and URL/title duplicates link as evidence',async()=>{
 const previous=globalThis.fetch;const rss=`<?xml version="1.0"?><rss version="2.0"><channel>
  <item><title>Vinç kiralama hizmet alımı için teklif çağrısı</title><link>https://www.eskisehir.bel.tr/ihale/vinc-hizmet-alimi-1</link><description>Eskişehir’de yük kaldırma için mobil vinç kiralama hizmeti alınacaktır.</description><pubDate>Sat, 31 Oct 2026 09:00:00 +0300</pubDate></item>
  <item><title>Operatör aranıyor</title><link>https://www.eskisehir.bel.tr/ilan/operator-2</link><description>Vinç operatörü için iş ilanı.</description></item>
  <item><title>Şehir etkinliği</title><link>https://www.eskisehir.bel.tr/duyuru/etkinlik-3</link><description>Belediye etkinliği.</description></item>
 </channel></rss>`;
 globalThis.fetch=async()=>new Response(rss,{status:200,headers:{'content-type':'application/rss+xml; charset=utf-8','etag':'"feed-1"'}});
 try{let result=await scanLeadRadar(env,{manual:true});assert.deepEqual(result,{scanned:1,added:1,duplicates:0,rejected:2,errors:0,sourceIds:['eskisehir-bb-rss-notices'],seen:3});assert.equal(sql.prepare("SELECT last_scan_count FROM lead_radar_sources WHERE id='eskisehir-bb-rss-notices'").get().last_scan_count,3);let lead=sql.prepare("SELECT id,city,classification,status,source_url FROM lead_radar_leads WHERE source_url LIKE '%/ihale/vinc-hizmet-alimi-1'").get();assert.equal(lead.city,'Eskişehir');assert.equal(lead.classification,'relevant');assert.equal(lead.status,'review');assert.equal(sql.prepare('SELECT COUNT(*) n FROM lead_radar_evidence WHERE lead_id=?').get(lead.id).n,1);
  result=await scanLeadRadar(env,{manual:true});assert.equal(result.added,0);assert.equal(result.duplicates,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM lead_radar_evidence WHERE lead_id=?').get(lead.id).n,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM lead_radar_scan_runs').get().n,2);
 }finally{globalThis.fetch=previous}
});

test('admin full scan is persisted as a resumable D1 job and exposes progress',async()=>{
 const queued=await enqueueLeadRadarScan(env,'admin');
 assert.equal(queued.job.status,'queued');assert.equal(queued.job.source_total,1);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>',{status:200,headers:{'content-type':'application/rss+xml'}});
 try{
  const progressed=await processLeadRadarQueue(env,{chunkSize:1});assert.equal(progressed.status,'completed');assert.equal(progressed.scanned,1);
  const response=await api.onRequestGet({request:request(),env});const data=await response.json();const row=data.jobs.find(j=>j.id===queued.job.id);
  assert.equal(row.status,'completed');assert.equal(row.sources_scanned,1);assert.equal(row.errors,0);
 }finally{globalThis.fetch=previous}
});
test('creates source-linked lead, prevents duplicates, and never sends outreach',async()=>{
 const lead={action:'lead',source_url:'https://anfa.com.tr/duyuru/test-2026/',title:'Vinç kiralama hizmet alımı',organization:'Kurum',city:'Ankara',service_type:'Mobil vinç',source_excerpt:'Kaldırma ve vinç kiralama hizmeti alımı duyurusu.'};
 let r=await api.onRequestPost({request:request('POST',lead),env});assert.equal(r.status,201);assert.equal((await r.json()).duplicate,false);
 r=await api.onRequestPost({request:request('POST',lead),env});assert.equal(r.status,200);assert.equal((await r.json()).duplicate,true);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM lead_radar_leads WHERE source_url=?').get(lead.source_url).n,1);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM lead_radar_leads WHERE contact_status='contacted'").get().n,0);
});
test('rejects LinkedIn and social scraping and requires a human review before contact approval',async()=>{
 let r=await api.onRequestPost({request:request('POST',{action:'source',name:'LinkedIn',feed_url:'https://www.linkedin.com/feed.rss',source_type:'rss',terms_attested:true}),env});assert.equal(r.status,400);
 const id=sql.prepare("SELECT id FROM lead_radar_leads WHERE status='review' AND source_url='https://anfa.com.tr/duyuru/test-2026/'").get().id;
 r=await api.onRequestPatch({request:request('PATCH',{id,contact_status:'approved_for_manual_contact'}),env});assert.equal(r.status,409);
 r=await api.onRequestPatch({request:request('PATCH',{id,status:'approved'}),env});assert.equal(r.status,200);
 r=await api.onRequestPatch({request:request('PATCH',{id,contact_status:'approved_for_manual_contact'}),env});assert.equal(r.status,200);
 assert.equal(sql.prepare("SELECT contact_status FROM lead_radar_leads WHERE id=?").get(id).contact_status,'approved_for_manual_contact');
});
test('accepts the officially published Trakya Development Agency RSS feed after terms attestation',async()=>{
 const r=await api.onRequestPost({request:request('POST',{action:'source',name:'Trakya Kalkınma Ajansı — İhale İlanları RSS',feed_url:'https://www.trakyaka.org.tr/tr/34846/Ihale-Ilanlari/type/rss',source_type:'rss',source_category:'public_tender',province_codes:[22,39,59],terms_attested:true}),env});
 assert.equal(r.status,201);
 const source=sql.prepare('SELECT feed_url,enabled,permission_status,province_codes_json FROM lead_radar_sources WHERE feed_url=?').get('https://www.trakyaka.org.tr/tr/34846/Ihale-Ilanlari/type/rss');
 assert.equal(source.enabled,1);assert.equal(source.permission_status,'explicitly_attested');assert.equal(source.province_codes_json,'[22,39,59]');
});
test('Google Alerts RSS can be added from admin and creates review-only leads with publication disabled',async()=>{
 const feed='https://www.google.com/alerts/feeds/test-user/test-secret';
 let r=await api.onRequestPost({request:request('POST',{action:'source',name:'Google Alerts — Kocaeli vinç',feed_url:feed,source_type:'rss',source_category:'other',province_codes:[41],terms_attested:true,republish_attested:true,republish_terms_url:'https://www.google.com/terms',auto_publish_enabled:true}),env});
 assert.equal(r.status,201);
 const source=sql.prepare('SELECT id,feed_url,enabled,auto_publish_enabled,republish_attested,scan_interval_seconds FROM lead_radar_sources WHERE feed_url=?').get(feed);
 assert.ok(source);assert.equal(source.enabled,1);assert.equal(source.auto_publish_enabled,0);assert.equal(source.republish_attested,0);
 const previous=globalThis.fetch;
 const atom='<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><id>alert-1</id><title>Gebze vinç kiralama hizmet alımı duyurusu</title><link href="https://www.google.com/url?q=https%3A%2F%2Fwww.kik.gov.tr%2Fduyuru%2Fvinc-1"/><published>'+new Date().toISOString()+'</published></entry></feed>';
 globalThis.fetch=async(_url,options)=>{assert.equal(options.redirect,'manual');return new Response(atom,{status:200,headers:{'content-type':'application/atom+xml'}})};
 try{
  const first=await scanLeadRadar(env,{manual:true});assert.equal(first.added,1);assert.equal(first.errors,0);
  const lead=sql.prepare('SELECT status,verification,source_url,city,public_at,publication_method FROM lead_radar_leads WHERE source_id=?').get(source.id);
  assert.equal(lead.status,'review');assert.equal(lead.verification,'unverified');assert.equal(lead.source_url,'https://www.kik.gov.tr/duyuru/vinc-1');assert.equal(lead.city,'Kocaeli');assert.equal(lead.public_at,null);
  const second=await scanLeadRadar(env,{manual:true});assert.equal(second.added,0);assert.equal(second.duplicates,1);
 }finally{globalThis.fetch=previous}
});
test('Google Alerts candidates classify all five planned service categories and exclude suppliers',async()=>{
 const feed='https://www.google.com/alerts/feeds/category-test/secret';
 const added=await api.onRequestPost({request:request('POST',{action:'source',name:'Kategori testi',feed_url:feed,source_type:'rss',source_category:'other',province_codes:[41],terms_attested:true}),env});assert.equal(added.status,201);
 const source=sql.prepare('SELECT id FROM lead_radar_sources WHERE feed_url=?').get(feed);
 sql.prepare('UPDATE lead_radar_sources SET enabled=0 WHERE id!=?').run(source.id);
 const rows=[
  ['Vinç kiralama hizmet alımı','vinc'],
  ['Gebze mobil lastik hizmeti alımı için yerinde lastik değişimi','lastik'],
  ['Kocaeli manlift kiralama hizmet alımı','manlift'],
  ['Gebze forklift kiralama hizmet alımı','forklift'],
  ['Gebze nakliyat asansörü kiralama hizmet talebi','asansor'],
  ['Forklift satılık, uygun fiyat','satici']
 ];
 const entries=rows.map(([title,path],i)=>`<entry><id>cat-${i}</id><title>${title}</title><link href="https://www.kik.gov.tr/duyuru/${path}-${i}"/><published>${new Date().toISOString()}</published></entry>`).join('');
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(`<feed xmlns="http://www.w3.org/2005/Atom">${entries}</feed>`,{status:200,headers:{'content-type':'application/atom+xml'}});
 const aiCalls=[],aiEnv={...env,AI_ENABLED:'true',AI:{run:async(_model,input)=>{aiCalls.push(input);return{response:JSON.stringify({kind:'buyer_need',confidence:.92})}}}};
 try{
  const result=await scanLeadRadar(aiEnv,{manual:true});assert.equal(result.added,5);assert.equal(result.rejected,1);assert.equal(result.errors,0);assert.equal(aiCalls.length,5);
  const found=sql.prepare('SELECT title,service_type,status,verification,public_at FROM lead_radar_leads WHERE source_id=? ORDER BY title').all(source.id);
  assert.equal(found.length,5);assert.ok(found.every(x=>x.status==='review'&&x.verification==='unverified'&&x.public_at===null));
  const categories=new Set(found.map(x=>x.service_type));
  for(const value of ['Mobil vinç / kaldırma','Mobil lastikçi','Manlift / platform','İş makinesi','Nakliyat asansörü'])assert.ok(categories.has(value),value);
 }finally{globalThis.fetch=previous;sql.prepare('UPDATE lead_radar_sources SET enabled=1').run()}
});

test('AI review uses source evidence, checks rights and revisions, publishes atomically and audits decisions',async()=>{
 const source=sql.prepare("SELECT id FROM lead_radar_sources WHERE id='eskisehir-bb-rss-notices'").get();
 sql.prepare("UPDATE lead_radar_sources SET enabled=1,terms_attested=1,republish_attested=0,republish_checked_at=unixepoch(),republish_terms_url='https://www.eskisehir.bel.tr/terms' WHERE id=?").run(source.id);
 const id='review-fixture-01',url='https://www.eskisehir.bel.tr/ihale/review-fixture';
 sql.prepare("INSERT INTO lead_radar_leads(id,source_id,title,service_type,source_url,status) VALUES(?,?,?,'Mobil vinç',?,'review')").run(id,source.id,'Vinç kiralama hizmet alımı',url);
 const page='<html><body><h1>Vinç kiralama hizmet alımı duyurusu</h1><p>Belediye için mobil vinç kiralama hizmet alımı yapılacaktır.</p><p>Son başvuru: 31.12.2030 15:00 tarihinde sona erecektir.</p></body></html>';
 let currentPage=page;const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(currentPage,{headers:{'content-type':'text/html'}});
 const aiEnv={...env,AI_ENABLED:'true',AI:{run:async()=>({response:JSON.stringify({indices:[1]})})}};
 const patch=async body=>api.onRequestPatch({request:request('PATCH',{id,...body}),env:aiEnv});
 try{
  let r=await patch({action:'approve_publish',verified_now:true});assert.equal(r.status,409);
  r=await patch({action:'rewrite'});assert.equal(r.status,200,await r.clone().text());
  let draft=sql.prepare('SELECT * FROM lead_radar_ai_drafts WHERE lead_id=?').get(id);assert.match(draft.summary,/mobil vinç kiralama/);assert.ok(draft.expires_at);
  r=await patch({action:'approve_publish',revision:draft.revision,verified_now:true});assert.equal(r.status,403,'admin approval cannot replace a license');
  sql.prepare('UPDATE lead_radar_sources SET republish_attested=1 WHERE id=?').run(source.id);
  r=await patch({action:'approve_publish',revision:'stale',verified_now:true});assert.equal(r.status,409);
  currentPage=page.replace('mobil vinç','sepetli vinç');r=await patch({action:'approve_publish',revision:draft.revision,verified_now:true});assert.equal(r.status,409);currentPage=page;
  r=await patch({action:'approve_publish',revision:draft.revision,verified_now:false});assert.equal(r.status,400);
  r=await patch({action:'approve_publish',revision:draft.revision,verified_now:true,public_summary:'INVENTED',expires_at:'2099-01-01'});assert.equal(r.status,200,await r.clone().text());
  const live=sql.prepare('SELECT * FROM lead_radar_leads WHERE id=?').get(id);assert.equal(live.public_summary,draft.summary);assert.equal(live.public_expires_at,draft.expires_at);assert.equal(live.verification,'manual_reviewed');assert.equal(live.publication_method,'manual');
  r=await patch({action:'approve_publish',revision:draft.revision,verified_now:true});assert.equal(r.status,409);
  const {withJobBoard}=await import('../functions/_lib/job-board.js');const worker=withJobBoard({fetch:()=>new Response('base')},{});sql.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?)').run('fixture-member','member@example.org','member@example.org','member',1);sql.prepare('INSERT INTO user_sessions VALUES(?,?,?)').run(await digest('fixture-member-token'),'fixture-member',Math.floor(Date.now()/1000)+3600);const publicBody=await (await worker.fetch(new Request('https://yukvinc.com.tr/api/jobs',{headers:{cookie:'__Host-yv_member=fixture-member-token'}}),{DB,AI_ENABLED:'false'})).json();const published=publicBody.items.find(x=>x.source_url===url);assert.equal(published.kind,'official_tender');assert.equal(published.source_url,url);
  r=await patch({action:'reject'});assert.equal(r.status,200);assert.equal(sql.prepare('SELECT public_at FROM lead_radar_leads WHERE id=?').get(id).public_at,null);
  r=await patch({action:'rewrite',revision:draft.revision});assert.equal(r.status,409);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM lead_radar_review_events WHERE lead_id=? AND action='approve_publish'").get(id).n,1);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM lead_radar_review_events WHERE lead_id=? AND action='reject'").get(id).n,1);
 }finally{globalThis.fetch=previous;}
});

test('HTML source is processed as HTML through the real scanner and scan_step requires admin auth',async()=>{
 const previous=globalThis.fetch;
 sql.prepare('UPDATE lead_radar_sources SET enabled=0').run();
 sql.prepare("INSERT INTO lead_radar_sources(id,name,feed_url,source_type,terms_attested,enabled,source_category,access_method,permission_status) VALUES('html-adapter-test','HTML test','https://www.kocaeli.bel.tr/ihale-test','manual',0,1,'public_tender','permitted_html','robots_allowed')").run();
 const calls=[];globalThis.fetch=async url=>{calls.push(String(url));return String(url).endsWith('/robots.txt')?new Response('User-agent: *\nAllow: /',{headers:{'content-type':'text/plain'}}):new Response('<a href="/service-test-new">Kocaeli mobil vinç kiralama hizmet alımı</a>',{headers:{'content-type':'text/html'}});};
 try{
  const scanned=await scanLeadRadar(env,{manual:true});assert.equal(scanned.scanned,1);assert.equal(scanned.errors,0);assert.equal(scanned.added,1);assert.equal(calls.length,2);assert.ok(calls[0].endsWith('/robots.txt'));
  const lead=sql.prepare("SELECT status,public_at FROM lead_radar_leads WHERE source_url='https://www.kocaeli.bel.tr/service-test-new'").get();assert.equal(lead.status,'review');assert.equal(lead.public_at,null);
  const denied=await api.onRequestPost({request:new Request('https://yukvinc.com.tr/api/admin-lead-radar',{method:'POST',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json'},body:JSON.stringify({action:'scan_step'})}),env});assert.equal(denied.status,401);
 }finally{globalThis.fetch=previous;sql.prepare("UPDATE lead_radar_sources SET enabled=0 WHERE id='html-adapter-test'").run();}
});

test('investment and marketing text cannot match the truck word inside yatirim',async()=>{
 const previous=globalThis.fetch;sql.prepare('UPDATE lead_radar_sources SET enabled=0').run();
 sql.prepare("INSERT INTO lead_radar_sources(id,name,feed_url,source_type,terms_attested,enabled,permission_status) VALUES('word-boundary-test','Test RSS','https://www.kik.gov.tr/rss-boundary-test','rss',1,1,'publisher_rss')").run();
 globalThis.fetch=async()=>new Response('<rss><channel><item><title>Strateji Geliştirme ve Marka Hizmet Alımı</title><link>https://www.kik.gov.tr/boundary-noise</link><description>Yatırım tanıtımı ve dijital dönüşüm hizmet alımı için ihale duyurusu.</description></item><item><title>Tır çekici kiralama hizmet alımı</title><link>https://www.kik.gov.tr/boundary-truck</link><description>Yük taşımacılığı için tır çekici kiralama hizmet alımı yapılacaktır.</description></item></channel></rss>',{headers:{'content-type':'application/rss+xml'}});
 try{const result=await scanLeadRadar(env,{manual:true});assert.equal(result.rejected,1);assert.equal(result.added,1);assert.equal(sql.prepare("SELECT COUNT(*) n FROM lead_radar_leads WHERE source_url='https://www.kik.gov.tr/boundary-noise'").get().n,0);}finally{globalThis.fetch=previous;}
});
