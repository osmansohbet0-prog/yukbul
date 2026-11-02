import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {resolveRadarLocation,scanLeadRadar,maybeAutoPublish,parseRadarDeadline} from '../functions/_lib/lead-radar.js';

function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE user_login_attempts(id INTEGER PRIMARY KEY,ip_hash TEXT,action TEXT,created_at INTEGER);');
 for(const name of ['0021_job_board.sql','0022_lead_radar.sql','0023_job_radar_publish_and_quota.sql','0024_lead_radar_v3.sql','0025_lead_radar_queue_and_rights.sql','0027_radar_ai_review.sql'])sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 sql.exec(readFileSync(new URL('../staging/sql/004_radar_buyer_contacts.sql',import.meta.url),'utf8'));
 sql.exec('CREATE TABLE ai_model_budget(day TEXT,actor TEXT,calls INTEGER,PRIMARY KEY(day,actor));DELETE FROM lead_radar_evidence;DELETE FROM lead_radar_leads;DELETE FROM lead_radar_sources;');
 const DB={async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}},prepare(q){let args=[];return{bind(...x){args=x;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return{results:sql.prepare(q).all(...args)}},async run(){const r=sql.prepare(q).run(...args);return{meta:{changes:Number(r.changes)}}}}}};
 sql.exec(`INSERT INTO lead_radar_sources(id,name,feed_url,source_type,enabled,terms_attested,permission_status,access_method,province_codes_json,source_category,republish_attested,republish_checked_at,republish_terms_url) VALUES('evidence-test-source','Official publisher','https://www.kocaeli.bel.tr/feed','rss',1,1,'explicitly_attested','rss','[34,41]','public_tender',1,unixepoch(),'https://www.kocaeli.bel.tr/terms')`);
 return {sql,DB,source:()=>sql.prepare("SELECT * FROM lead_radar_sources WHERE id='evidence-test-source'").get()};
}
const title='Gebze fabrikamıza vinç kiralama hizmet alımı';
const expiry=()=>Math.floor((Date.now()/1000+86400)/60)*60+59;
const localDate=epoch=>new Date(epoch*1000).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
function originalPage(until,{published=new Date(Date.now()-60000).toISOString()}={}){return '<meta property="article:published_time" content="'+published+'"><h1>'+title+'</h1><p>Gebze fabrikamıza vinç kiralama hizmet alımı için teklif isteniyor. Fabrikamızda makine indirme ve yerleştirme işi yapılacaktır.</p><p>Son teklif tarihi: '+localDate(until)+'</p>';}

test('explicit city/district evidence wins over source coverage, without inventing a city from multi-province scope',()=>{
 assert.deepEqual(resolveRadarLocation('Gebze fabrikamıza vinç lazım',{scope:[34,41]}),{city:'Kocaeli',district:'Gebze'});
 assert.deepEqual(resolveRadarLocation('Ankara fabrikasına vinç lazım',{scope:[34,41]}),{city:'Ankara',district:null});
 assert.deepEqual(resolveRadarLocation('Fabrikamıza vinç lazım',{scope:[34,41]}),{city:null,district:null});
 assert.deepEqual(resolveRadarLocation('Ankara ve İstanbul proje çalışmaları',{scope:[41]}),{city:null,district:null});
 assert.deepEqual(resolveRadarLocation('Merkez ilçede vinç lazım',{scope:[34,41]}),{city:null,district:null});
});

test('scanner carries source excerpt, organization and district into the real Kocaeli AI draft path, and preserves low AI confidence',async()=>{
 const {sql,DB}=fixture(),until=expiry(),url='https://www.kocaeli.bel.tr/evidence-demand';
 const feed='<rss><channel><item><title>'+title+'</title><link>'+url+'</link><description>Gebze fabrikamıza vinç kiralama hizmet alımı için teklif isteniyor.</description><author>Gebze Fabrika AŞ</author><pubDate>'+new Date(Date.now()-60000).toISOString()+'</pubDate></item></channel></rss>';
 const previous=fetch;globalThis.fetch=async input=>new Response(String(input).endsWith('/feed')?feed:originalPage(until),{headers:{'content-type':String(input).endsWith('/feed')?'application/rss+xml':'text/html'}});
 const calls=[];
 const AI={async run(_model,payload){calls.push(payload);return {response:payload.response_format?JSON.stringify({title,description:'Gebze fabrikasında makine indirme ve yerleştirme için vinç kiralama hizmetine yönelik teklifler bekleniyor. Ayrıntılar asıl kaynakta incelenmelidir.',missingFacts:[]}):JSON.stringify({kind:'buyer_need',confidence:.2})};}};
 try{
  const result=await scanLeadRadar({DB,AI,AI_ENABLED:'true'},{manual:true});assert.equal(result.added,1);
  const lead=sql.prepare('SELECT * FROM lead_radar_leads WHERE source_url=?').get(url);assert.equal(lead.city,'Kocaeli');assert.equal(lead.district,'Gebze');assert.equal(lead.organization,'Gebze Fabrika AŞ');assert.equal(lead.confidence,.2);assert.equal(lead.public_at,null);
  const draft=sql.prepare('SELECT * FROM lead_radar_ai_drafts WHERE lead_id=?').get(lead.id);assert.ok(draft,'Scanner must create a draft, not lose its inferred work location.');
  const request=JSON.parse(calls.find(p=>p.response_format).messages[1].content);assert.equal(request.city,'Kocaeli');assert.equal(request.district,'Gebze');assert.equal(request.organization,'Gebze Fabrika AŞ');assert.ok(request.verifiedSourceText.includes('makine indirme'));
 }finally{globalThis.fetch=previous;sql.close();}
});

test('auto publication rejects a refreshed feed for an old original and a past or mismatched bid minute',async()=>{
 const {sql,DB,source}=fixture(),until=expiry();
 sql.prepare("INSERT INTO lead_radar_leads(id,source_id,title,city,service_type,source_url,status) VALUES('auto-evidence-test','evidence-test-source',?,'Kocaeli','Vinç','https://www.kocaeli.bel.tr/evidence-demand','review')").run(title);
 const item={title,excerpt:'Vinç kiralama hizmet alımı talebi.',url:'https://www.kocaeli.bel.tr/evidence-demand',published_at:new Date(Date.now()-60000).toISOString(),expires_at:until};
 let page=originalPage(until,{published:'2020-01-01T10:00:00Z'});const previous=fetch;globalThis.fetch=async()=>new Response(page);
 const publish=(confidence=.95)=>maybeAutoPublish({DB},source(),item,'auto-evidence-test',{kind:'buyer_need',confidence},'Kocaeli');
 try{
  assert.equal(await publish(),false);page=originalPage(until-3600);assert.equal(await publish(),false);
  page=originalPage(Math.floor(Date.now()/1000)-3600);assert.equal(await publish(),false);
  page=originalPage(until);assert.equal(await publish(NaN),false);assert.equal(await publish(Infinity),false);assert.equal(await publish(2),false);
  assert.equal(await publish(),true);
 }finally{globalThis.fetch=previous;sql.close();}
});

test('source rights revoked during original-page verification cannot race into automatic publication',async()=>{
 const {sql,DB,source}=fixture(),until=expiry();
 sql.prepare("INSERT INTO lead_radar_leads(id,source_id,title,city,service_type,source_url,status) VALUES('auto-race-test','evidence-test-source',?,'Kocaeli','Vinç','https://www.kocaeli.bel.tr/evidence-demand','review')").run(title);
 const snapshot=source(),previous=fetch;globalThis.fetch=async()=>{sql.exec("UPDATE lead_radar_sources SET enabled=0 WHERE id='evidence-test-source'");return new Response(originalPage(until));};
 try{assert.equal(await maybeAutoPublish({DB},snapshot,{title,excerpt:'Vinç kiralama hizmet alımı talebi.',url:'https://www.kocaeli.bel.tr/evidence-demand',published_at:new Date(Date.now()-60000).toISOString(),expires_at:until},'auto-race-test',{kind:'buyer_need',confidence:.95},'Kocaeli'),false);assert.equal(sql.prepare("SELECT public_at FROM lead_radar_leads WHERE id='auto-race-test'").get().public_at,null);}finally{globalThis.fetch=previous;sql.close();}
});
test('deadline parser keeps the stated timezone and never adds seconds to an explicit closing time',()=>{
 assert.equal(parseRadarDeadline('02.11.2026 10:00',{requireTime:true}),Date.parse('2026-11-02T10:00:00+03:00')/1000);
 assert.equal(parseRadarDeadline('2026-11-02T10:00:00Z',{requireTime:true}),Date.parse('2026-11-02T10:00:00Z')/1000);
 assert.equal(parseRadarDeadline('2026-11-02T10:00:00+05:00',{requireTime:true}),Date.parse('2026-11-02T10:00:00+05:00')/1000);
 assert.equal(parseRadarDeadline('03.11.2026',{requireTime:true}),null);
 assert.equal(parseRadarDeadline('31.02.2026 10:00',{requireTime:true}),null);
});
test('automatic publication rejects a just-closed minute and a source with no closing hour',async()=>{
 const {sql,DB,source}=fixture();const realNow=Date.now,now=Math.floor(realNow()/60000)*60000+30000;
 sql.exec("UPDATE lead_radar_sources SET republish_checked_at="+(Math.floor(now/1000)-120));
 sql.prepare("INSERT INTO lead_radar_leads(id,source_id,title,city,service_type,source_url,status) VALUES('closed-minute-test','evidence-test-source',?,'Kocaeli','Vinç','https://www.kocaeli.bel.tr/evidence-demand','review')").run(title);
 const closed=Math.floor(now/60000)*60,dayEnd=new Date(now+86400000);dayEnd.setUTCHours(20,59,59,0);
 let page=originalPage(closed,{published:new Date(now-60000).toISOString()});const previous=fetch;globalThis.fetch=async()=>new Response(page);Date.now=()=>now;
 const item={title,excerpt:'Vinç kiralama hizmet alımı talebi.',url:'https://www.kocaeli.bel.tr/evidence-demand',published_at:new Date(now-60000).toISOString(),expires_at:closed+59};
 try{
  assert.equal(await maybeAutoPublish({DB},source(),item,'closed-minute-test',{kind:'buyer_need',confidence:.99},'Kocaeli'),false);
  page=originalPage(Math.floor(dayEnd/1000)).replace(/(Son teklif tarihi: \d{2}\.\d{2}\.\d{4})[^<]*/, '$1');
  assert.equal(await maybeAutoPublish({DB},source(),{...item,expires_at:Math.floor(dayEnd/1000)},'closed-minute-test',{kind:'buyer_need',confidence:.99},'Kocaeli'),false);
 }finally{Date.now=realNow;globalThis.fetch=previous;sql.close();}
});
test('different buyers with the same title and city remain separate opportunities',async()=>{
 const {sql,DB}=fixture(),previous=fetch;
 const feed='<rss><channel>'+['Birinci Fabrika AŞ','İkinci Fabrika AŞ'].map((organization,index)=>'<item><title>'+title+'</title><link>https://www.kocaeli.bel.tr/demand-'+index+'</link><description>Gebze fabrikamıza vinç kiralama hizmet alımı için teklif isteniyor.</description><author>'+organization+'</author><pubDate>'+new Date(Date.now()-60000).toISOString()+'</pubDate></item>').join('')+'</channel></rss>';
 globalThis.fetch=async()=>new Response(feed,{headers:{'content-type':'application/rss+xml'}});
 try{const env={DB,AI_ENABLED:'false'},first=await scanLeadRadar(env,{manual:true});assert.equal(first.added,2);assert.equal(first.duplicates,0);assert.equal(sql.prepare('SELECT COUNT(DISTINCT organization) n FROM lead_radar_leads').get().n,2);const repeat=await scanLeadRadar(env,{manual:true});assert.equal(repeat.duplicates,2);}finally{globalThis.fetch=previous;sql.close();}
});
