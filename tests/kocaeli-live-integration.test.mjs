import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {digest} from '../functions/_lib/core.js';
import * as radar from '../functions/_lib/lead-radar.js';
import {publisherPublication,rentalContentAllowed} from '../functions/_lib/radar-kocaeli-integration.js';
import {withJobBoard} from '../functions/_lib/job-board.js';
import {nationalCoverage,nationalSourceCatalog,nationalDemandQueries} from '../functions/_lib/radar-national-catalog.js';
import jobAssets from '../src/job-board-assets.js';

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
test('nationwide catalog covers every province and validates district and neighborhood queries',()=>{
 const coverage=nationalCoverage();assert.equal(coverage.provinces,81);assert.ok(coverage.districts>970);assert.equal(coverage.municipalities,929);
 for(let code=1;code<=81;code++)assert.ok(nationalSourceCatalog(code).total>0);
 assert.ok(nationalSourceCatalog(41).districts.includes('Gebze'));
 const query=nationalDemandQueries(41,'Gebze','Güzeller Mahallesi');assert.equal(query.queries.length,4);assert.ok(query.queries.some(x=>x.query.includes('telehandler')));assert.equal(query.automaticExecution,false);
 assert.equal(nationalDemandQueries(41,'Kadıköy'),null);assert.equal(nationalDemandQueries(41,'Gebze','<script>'),null);
});
test('automatic publication requires over 90 percent plus source rights, freshness and verified open demand',async()=>{
 const {sql,env}=fixture();source(sql,1);const title='Gebze vinç kiralama hizmet alımı için teklif isteniyor';
 sql.prepare("INSERT INTO lead_radar_leads(id,source_id,title,city,service_type,source_url,status) VALUES('auto-publication-test','kocaeli-test-source',?,'Kocaeli','Vinç','https://www.kocaeli.bel.tr/test','review')").run(title);
 sql.exec("UPDATE lead_radar_sources SET source_category='public_tender',republish_attested=1,republish_checked_at=unixepoch(),republish_terms_url='https://www.kocaeli.bel.tr/terms'");
 const src=()=>sql.prepare("SELECT * FROM lead_radar_sources WHERE id='kocaeli-test-source'").get();
 const expiry=Math.floor((Date.now()/1000+86400)/60)*60+59, date=new Date(expiry*1000).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const item={title,excerpt:'Gebze fabrikası için vinç kiralama hizmet alımı talebi.',url:'https://www.kocaeli.bel.tr/test',expires_at:expiry,published_at:new Date().toISOString()};
 const publish=(score=.91,source=src(),record=item)=>radar.maybeAutoPublish(env,source,record,'auto-publication-test',{kind:'buyer_need',confidence:score},'Kocaeli');
 const previous=fetch;globalThis.fetch=async()=>new Response('<meta property="article:published_time" content="'+new Date().toISOString()+'"><h1>'+title+'</h1><p>Vinç kiralama hizmet alımı için son teklif tarihi '+date+'</p>');
 try{
  assert.equal(await publish(.90),false);
  assert.equal(await publish(.91,{...src(),republish_attested:0}),false);
  assert.equal(await publish(.99,src(),{...item,published_at:'2020-01-01T10:00:00Z'}),false);
  assert.equal(await publish(.99,src(),{...item,title:'Gebze vinç satın alma mal alımı'}),false);
  assert.equal(await publish(),true);
  assert.equal(sql.prepare("SELECT publication_method FROM lead_radar_leads WHERE id='auto-publication-test'").get().publication_method,'automatic');
 }finally{globalThis.fetch=previous;}
});
test('anonymous API and rendered cards contain only a short teaser, never job details or tender links',async()=>{
 const {sql,env}=fixture();
 sql.prepare(`INSERT INTO lead_radar_leads(id,title,city,service_type,source_url,status,public_at,public_expires_at,verified_at,public_summary) VALUES('private-lead-test','Gebze fabrikası özel iş ayrıntısı','Kocaeli','Vinç','https://www.kocaeli.bel.tr/secret-tender','approved',unixepoch(),unixepoch()+86400,unixepoch(),'Gizli kapsam ve makine ayrıntısı')`).run();
 const worker=withJobBoard({fetch:async()=>new Response('fallback')},jobAssets);
 const api=await worker.fetch(new Request('https://yukvinc.com.tr/api/jobs'),env,{});const json=await api.json();assert.equal(json.items.length,1);assert.equal(json.items[0].locked,true);
 for(const key of ['description','source_url','id','organization','contact_phone'])assert.equal(json.items[0][key],undefined);
 const r=await worker.fetch(new Request('https://yukvinc.com.tr/is-talepleri/'),env,{});const html=await r.text();
 assert.doesNotMatch(html,/secret-tender|özel iş ayrıntısı|Gizli kapsam|Resmî duyuruyu aç|ihale-duyurulari/);assert.match(html,/üye girişi/);
 const client=jobAssets['/assets/job-board-v20261102private.js'][1];assert.ok(client.indexOf('if(job.locked)')<client.indexOf("if(job.kind==='official_tender')"));
});
test('a permissioned HTML source with separate republication rights supports the human approval flow',async()=>{
 const {sql,env}=fixture();await admin(sql);source(sql,1);
 sql.exec("UPDATE lead_radar_sources SET access_method='permitted_html',permission_status='robots_allowed',republish_attested=1,republish_checked_at=unixepoch(),republish_terms_url='https://www.kocaeli.bel.tr/terms'");
 const leadId='html-manual-publish',title='Gebze fabrikamıza vinç kiralama hizmet alımı';
 sql.prepare("INSERT INTO lead_radar_leads(id,source_id,title,city,district,service_type,source_url,status) VALUES(?,'kocaeli-test-source',?,'Kocaeli','Gebze','Mobil vinç','https://www.kocaeli.bel.tr/html-demand','review')").run(leadId,title);
 const until=new Date(Date.now()+86400000).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),published=new Date(Date.now()-60000).toISOString();
 const html='<meta property="article:published_time" content="'+published+'"><h1>'+title+'</h1><p>Gebze fabrikamıza vinç kiralama hizmet alımı için teklif isteniyor. Fabrikamızda makine indirme ve yerleştirme yapılacaktır.</p><p>Son teklif tarihi: '+until+'</p>';
 const previous=fetch;globalThis.fetch=async url=>new Response(String(url).endsWith('/robots.txt')?'User-agent: *\nAllow: /':html,{headers:{'content-type':String(url).endsWith('/robots.txt')?'text/plain':'text/html'}});
 const aiEnv={...env,AI_ENABLED:'true',AI:{run:async()=>({response:JSON.stringify({title,description:'Gebze fabrikasında makine indirme ve yerleştirme işi için vinç kiralama hizmetine yönelik teklifler bekleniyor. Koşullar asıl kaynakta incelenmelidir.',missingFacts:[]})})}};
 try{
  let r=await radar.onRequestPatch({request:req('PATCH',{id:leadId,action:'rewrite',revision:''}),env:aiEnv});assert.equal(r.status,200,await r.clone().text());const draft=(await r.json()).draft;
  r=await radar.onRequestPatch({request:req('PATCH',{id:leadId,action:'approve_publish',revision:draft.revision,verified_now:true}),env:aiEnv});assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).published,true);
 }finally{globalThis.fetch=previous;sql.close();}
});
test('coverage and source guidance are admin-only and never activate catalog candidates',async()=>{
 const {sql,env}=fixture();await admin(sql);source(sql,0);
 for(const view of ['coverage_matrix','signal_guide']){
  let request=new Request('https://yukvinc.com.tr/api/radar?view='+view);assert.equal((await radar.onRequestGet({request,env})).status,401);
  request=new Request(request.url,{headers:{cookie:'__Host-yv_admin=integration-session'}});const r=await radar.onRequestGet({request,env});assert.equal(r.status,200);const data=await r.json();
  if(view==='coverage_matrix'){assert.equal(data.rows.length,81);assert.equal(data.summary.districts,973);assert.equal(data.rows.find(x=>x.provinceCode===41).working,0);}
  else {assert.ok(data.sources.every(x=>x.automaticEnabled===false&&x.republicationPermission==='not_verified'));assert.equal(data.outreach.automaticSending,false);}
 }
 assert.equal(sql.prepare('SELECT SUM(enabled) n FROM lead_radar_sources').get().n,0);
});
test('cheap source-text analysis is read-only and does not trust client verification claims',async()=>{
 const {sql,env}=fixture();await admin(sql);
 const body={action:'analyze_signal',text:'Gebze fabrikamıza 25–40 ton mobil vinç kiralamak istiyoruz.',sourceUrl:'https://www.kocaeli.bel.tr/duyuru',sourceVerified:true,republish_attested:true};
 let r=await radar.onRequestPost({request:req('POST',body,false),env});assert.equal(r.status,401);
 r=await radar.onRequestPost({request:req('POST',body),env});assert.equal(r.status,200);const result=await r.json();assert.equal(result.analysis.signalType,'direct_demand');assert.deepEqual(result.analysis.capacities.map(x=>[x.minTon,x.maxTon]),[[25,40]]);assert.equal(result.analysis.provenance.sourceVerified,false);assert.equal(result.analysis.automaticPublication,false);assert.equal(result.stored,false);assert.equal(result.published,false);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM lead_radar_leads').get().n,0);
 r=await radar.onRequestPost({request:req('POST',{...body,text:'a'.repeat(6001)}),env});assert.equal(r.status,400);
 r=await radar.onRequestPost({request:req('POST',body,true,'https://evil.example'),env});assert.equal(r.status,403);
});
