import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {digest} from '../functions/_lib/core.js';
import * as radar from '../functions/_lib/lead-radar.js';
import {publisherPublication,rentalContentAllowed} from '../functions/_lib/radar-kocaeli-integration.js';
import {withJobBoard} from '../functions/_lib/job-board.js';

function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE user_login_attempts(id INTEGER PRIMARY KEY,ip_hash TEXT,action TEXT,created_at INTEGER);CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,email_norm TEXT,role TEXT,active INTEGER);CREATE TABLE admin_sessions(token_hash TEXT,user_id TEXT,expires_at INTEGER);CREATE TABLE user_sessions(token_hash TEXT,user_id TEXT,expires_at INTEGER);`);
 for(const f of ['0021_job_board.sql','0022_lead_radar.sql','0023_job_radar_publish_and_quota.sql','0024_lead_radar_v3.sql','0025_lead_radar_queue_and_rights.sql','0027_radar_ai_review.sql'])sql.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 sql.exec(readFileSync(new URL('../staging/sql/004_radar_buyer_contacts.sql',import.meta.url),'utf8'));
 sql.exec('CREATE TABLE ai_model_budget(day TEXT,actor TEXT,calls INTEGER,PRIMARY KEY(day,actor));DELETE FROM lead_radar_evidence;DELETE FROM lead_radar_leads;DELETE FROM lead_radar_sources;');
 const DB={async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}},prepare(q){let v=[];return {bind(...x){v=x;return this},async first(){return sql.prepare(q).get(...v)||null},async all(){return {results:sql.prepare(q).all(...v)}},async run(){const r=sql.prepare(q).run(...v);return {meta:{changes:Number(r.changes)}}}}}};
 const env={DB,ADMIN_EMAIL:'owner@example.org',AI_ENABLED:'false'};
 return {sql,env};
}
async function admin(sql){sql.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('integration-admin','owner@example.org','owner@example.org','admin',1);sql.prepare('INSERT INTO admin_sessions VALUES(?,?,?)').run(await digest('integration-session'),'integration-admin',Math.floor(Date.now()/1000)+3600);}
function req(method='GET',data,cookie=true,origin='https://yukvinc.com.tr'){return new Request('https://yukvinc.com.tr/api/radar',{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie:'__Host-yv_admin=integration-session'}:{})},...(data?{body:JSON.stringify(data)}:{})});}
function source(sql,enabled=0){sql.prepare(`INSERT INTO lead_radar_sources(id,name,feed_url,source_type,enabled,terms_attested,permission_status,access_method,province_codes_json) VALUES('kocaeli-test-source','Kocaeli test','https://www.kocaeli.bel.tr/feed','rss',?,1,'explicitly_attested','rss','[41]')`).run(enabled);}

test('real session auth protects contact reads, writes and cross-origin publication',async()=>{
 const {sql,env}=fixture();await admin(sql);
 assert.equal((await radar.onRequestGet({request:req('GET',null,false),env})).status,401);
 assert.equal((await radar.onRequestPost({request:req('POST',{action:'scan_kocaeli'},false),env})).status,401);
 assert.equal((await radar.onRequestPatch({request:req('PATCH',{action:'approve_publish',id:'integration-lead'},true,'https://evil.example'),env})).status,403);
 sql.exec("UPDATE users SET role='member'");
 assert.equal((await radar.onRequestGet({request:req(),env})).status,401);
});
test('passive Kocaeli candidates execute no fetch and never count as working',async()=>{
 const {sql,env}=fixture();await admin(sql);source(sql,0);let calls=0;const previous=fetch;globalThis.fetch=async()=>{calls++;throw Error('must not fetch');};
 try{const r=await radar.onRequestPost({request:req('POST',{action:'scan_kocaeli'}),env});assert.equal(r.status,200);assert.equal((await r.json()).scanned,0);assert.equal(calls,0);const d=await (await radar.onRequestGet({request:req(),env})).json();assert.equal(d.kocaeli.workingSources,0);assert.equal(d.kocaeli.permittedSources,0);assert.equal(d.kocaeli.queryCount,96);assert.equal(d.kocaeli.authorizedSearchApiConfigured,false);}finally{globalThis.fetch=previous;}
});
test('publisher date excludes modified, indexed, conflicting and administrator dates',()=>{
 const now=Date.now(),at=new Date(now-3600000).toISOString();
 assert.equal(publisherPublication('<meta property="article:published_time" content="'+at+'">',now),at);
 assert.equal(publisherPublication('<script type="application/ld+json">'+JSON.stringify({dateModified:at})+'</script>',now),null);
 assert.equal(publisherPublication('<meta name="datePublished" content="'+at+'"><meta name="datePublished" content="2020-01-01T10:00:00Z">',now),null);
});
test('Kocaeli source -> AI draft -> revision, rights, freshness and human publication gate',async()=>{
 const {sql,env}=fixture();await admin(sql);source(sql,1);
 const title='Gebze fabrikamıza vinç kiralama hizmet alımı';const leadId='integration-kocaeli-lead';
 sql.prepare(`INSERT INTO lead_radar_leads(id,source_id,title,city,district,service_type,source_url,source_excerpt,status) VALUES(?,'kocaeli-test-source',?,'Kocaeli','Gebze','Mobil vinç / kaldırma','https://www.kocaeli.bel.tr/duyuru/test','Fabrikamıza vinç kiralama hizmet alımı için teklif isteniyor.','review')`).run(leadId,title);
 const date=new Date(Date.now()+86400000).toISOString().slice(0,10).split('-').reverse().join('.');
 let publishedAt=new Date(Date.now()-3600000).toISOString();
 const previous=fetch;globalThis.fetch=async()=>new Response('<meta property="article:published_time" content="'+publishedAt+'"><h1>'+title+'</h1><p>Gebze fabrikamıza vinç kiralama hizmet alımı için teklif isteniyor. Fabrikada makine indirme ve yerleştirme işi yapılacaktır.</p><p>Son teklif tarihi: '+date+' 15:00</p>',{headers:{'content-type':'text/html'}});
 const aiEnv={...env,AI_ENABLED:'true',AI:{run:async()=>({response:JSON.stringify({title,description:'Gebze fabrikasında makine indirme ve yerleştirme işi için vinç kiralama hizmetine yönelik teklifler bekleniyor. Koşullar asıl kaynakta incelenmelidir.',missingFacts:[]})})}};
 try{
  let r=await radar.onRequestPatch({request:req('PATCH',{id:leadId,action:'rewrite',revision:''}),env:aiEnv});assert.equal(r.status,200,await r.clone().text());const draft=(await r.json()).draft;
  assert.equal(sql.prepare('SELECT public_at FROM lead_radar_leads WHERE id=?').get(leadId).public_at,null);
  const publish=revision=>radar.onRequestPatch({request:req('PATCH',{id:leadId,action:'approve_publish',revision,verified_now:true}),env:aiEnv});
  assert.equal((await publish('wrong-revision')).status,409);assert.equal((await publish(draft.revision)).status,403);
  sql.exec("UPDATE lead_radar_sources SET republish_attested=1,republish_checked_at=unixepoch(),republish_terms_url='https://www.kocaeli.bel.tr/terms'");
  publishedAt='2020-01-01T10:00:00Z';assert.equal((await publish(draft.revision)).status,400);
  publishedAt=JSON.parse(sql.prepare('SELECT evidence_json FROM lead_radar_ai_drafts WHERE lead_id=?').get(leadId).evidence_json).authorPublishedAt;
  r=await publish(draft.revision);assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).published,true);
  assert.equal(sql.prepare('SELECT publication_method FROM lead_radar_leads WHERE id=?').get(leadId).publication_method,'manual');
 }finally{globalThis.fetch=previous;}
});
test('public jobs exclude purchase and never expose contact table data',async()=>{
 const {sql,env}=fixture();
 sql.prepare(`INSERT INTO radar_buyer_contacts(id,organization,city,business_phone,contact_source_url,source_kind) VALUES('integration-contact','Test kurum','Kocaeli','+902623183322','https://www.kocaeli.bel.tr/iletisim','official_organization_page')`).run();
 sql.prepare(`INSERT INTO lead_radar_leads(id,title,city,service_type,source_url,status,public_at,public_expires_at,verified_at,public_summary) VALUES('purchase-test','Gebze vinç satın alma ve raf sistemi','Kocaeli','Vinç','https://www.kocaeli.bel.tr/purchase','approved',unixepoch(),unixepoch()+86400,unixepoch(),'Vinç satın alma ve raf sistemi mal alımı')`).run();
 const worker=withJobBoard({fetch:async()=>new Response('fallback')},{});
 const r=await worker.fetch(new Request('https://yukvinc.com.tr/api/jobs'),env,{});assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('02623183322')&&!text.includes('purchase-test')&&!text.includes('buyerContacts'));
 for(const title of ['Gebze vinç satın alma','Gebze vinç operatörü aranıyor','Gebze filomuz hizmetinizdeyiz'])assert.equal(rentalContentAllowed({title}),false);
});
