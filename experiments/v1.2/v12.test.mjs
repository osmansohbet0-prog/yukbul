import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { capacities, listingProfile, tenderRequirements, matchTender } from './matching.mjs';
import { boardData, tenderApi, officialUrl } from './tenders.mjs';
import { guideTender } from './advisor.mjs';
import { runGuardian, guardianApi } from './guardian.mjs';
import { notificationApi, scanTenderAlerts, sendTenderAlerts } from './notifications.mjs';
import { createV12Worker } from './worker-overlay.mjs';

const now=Math.floor(Date.now()/1000);
const url='https://yukvinc.com.tr';
const machine=row=>listingProfile({id:'machine_001',title:'35 tonluk mobil vinç',description:'Çalışma yüksekliği: 20 m · operatörlü',category:'crane',city:'Ankara',active:true,...row});
const requirement=(title,overrides={})=>tenderRequirements({title,city:'Ankara',public_expires_at:now+86400,service_type:'crane',...overrides});
const match=(title,values)=>matchTender(machine(values),requirement(title),{now});
test('Turkish capacity spellings and ranges are normalized',()=>{
  for(const text of ['35 ton','35t','35 TONLUK','35.000 kg','otuz beş ton'])assert.equal(capacities(text)[0].minimum,35,text);
  assert.equal(capacities('35,5 ton')[0].maximum,35.5);
  assert.equal(capacities('30–40 ton')[0].maximum,40);
});
test('hard minimum, exact capacity and category stay separate',()=>{
  assert.ok(match('En az 30 ton mobil vinç, operatörlü').score>=75);
  assert.equal(match('En az 60 ton mobil vinç').score,0);
  assert.equal(match('Kesin 30 ton mobil vinç').score,0);
  assert.ok(match('Tam 35 ton mobil vinç, operatörlü').recommended);
  assert.equal(match('35 ton sepetli vinç').recommended,false);
  assert.equal(match('En az 35 ton mobil vinç',{title:'25–40 ton mobil vinç'}).band,'review');
});
test('unknown location, load chart, expired and inactive machines are conservative',()=>{
  assert.ok(match('En az 30 ton mobil vinç, yük diyagramı isteniyor',{city:null}).missing.length>=2);
  assert.ok(match('Mobil vinç').score<75);
  assert.equal(matchTender(machine({active:false}),requirement('35 ton')).recommended,false);
  assert.equal(matchTender(machine(),requirement('35 ton',{public_expires_at:now-1}),{now}).recommended,false);
  assert.equal(officialUrl('https://ekap.kik.gov.tr/abc'),'https://ekap.kik.gov.tr/abc');
  assert.equal(officialUrl('https://kik.gov.tr.attacker.invalid/'),null);
});

function fixture(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT,active INTEGER,email TEXT);
    CREATE TABLE listings(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,description TEXT,category TEXT,category_detail TEXT,service_category TEXT,city TEXT,district TEXT,price_unit TEXT,paid_until INTEGER,trial_expires_at INTEGER,updated_at INTEGER,status TEXT,member_paused_at INTEGER);
    CREATE TABLE listing_directory(listing_id TEXT,removed_at INTEGER);
    CREATE TABLE lead_radar_leads(id TEXT PRIMARY KEY,title TEXT,city TEXT,district TEXT,service_type TEXT,public_at INTEGER,public_expires_at INTEGER,source_url TEXT,source_excerpt TEXT,public_summary TEXT,updated_at INTEGER,status TEXT,verification TEXT);
    CREATE TABLE lead_radar_application_links(lead_id TEXT,official_application_url TEXT,official_notice_url TEXT,verification_status TEXT,ikn TEXT,portal_type TEXT);
    CREATE TABLE lead_radar_sources(name TEXT,enabled INTEGER,consecutive_errors INTEGER,last_success_at INTEGER,last_scan_status TEXT,last_scan_count INTEGER);
    CREATE TABLE tender_email_outbox(status TEXT,sent_at INTEGER,attempted_at INTEGER);
    CREATE TABLE v222_renewals(status TEXT);
    INSERT INTO users VALUES('member_001','member',1,'member@site.test'),('member_002','member',1,'other@site.test');
    INSERT INTO listings VALUES
      ('listing_001','member_001','35 tonluk mobil vinç','Operatörlü','crane',NULL,NULL,'Ankara',NULL,NULL,unixepoch()+8000,NULL,unixepoch(),'approved',NULL),
      ('listing_002','member_001','Oto kurtarıcı','Kurtarma hizmeti','tow',NULL,NULL,'İzmir',NULL,NULL,unixepoch()+8000,NULL,unixepoch(),'approved',NULL),
      ('listing_003','member_002','90 tonluk mobil vinç','Operatörlü','crane',NULL,NULL,'Ankara',NULL,NULL,unixepoch()+8000,NULL,unixepoch(),'approved',NULL);
    INSERT INTO lead_radar_leads VALUES
      ('lead_good_01','En az 30 ton mobil vinç, operatörlü','Ankara',NULL,'crane',unixepoch()-1,unixepoch()+8000,'https://ekap.kik.gov.tr/1',NULL,NULL,unixepoch(),'approved','official_source'),
      ('lead_high_01','En az 60 ton mobil vinç, operatörlü','Ankara',NULL,'crane',unixepoch()-1,unixepoch()+8000,'https://ekap.kik.gov.tr/2',NULL,NULL,unixepoch(),'approved','official_source'),
      ('lead_cancelled','İhale iptal edildi','Ankara',NULL,'crane',unixepoch()-1,unixepoch()+8000,'https://ekap.kik.gov.tr/3',NULL,NULL,unixepoch(),'approved','official_source'),
      ('lead_expired','En az 30 ton mobil vinç','Ankara',NULL,'crane',unixepoch()-20,unixepoch()-1,'https://ekap.kik.gov.tr/4',NULL,NULL,unixepoch(),'approved','official_source'),
      ('lead_duplicate','En az 30 ton mobil vinç, operatörlü','Ankara',NULL,'crane',unixepoch()-5,unixepoch()+8000,'https://ekap.kik.gov.tr/5',NULL,NULL,unixepoch(),'approved','official_source');
    INSERT INTO lead_radar_application_links VALUES
      ('lead_good_01',NULL,'https://ekap.kik.gov.tr/1','official_notice','2026/42','public_tender'),
      ('lead_duplicate',NULL,'https://ekap.kik.gov.tr/5','official_notice','2026/42','public_tender');
    INSERT INTO lead_radar_sources VALUES('Resmi kaynak',1,1,unixepoch()-50,'error',0);
  `);
  sqlite.exec(readFileSync(new URL('./migration.sql',import.meta.url),'utf8'));
  const db={
    prepare(sql){
      const stmt=sqlite.prepare(sql);
      let args=[];
      return {bind(...v){args=v;return this},first(){return stmt.get(...args)},all(){return {results:stmt.all(...args)}},run(){return {meta:{changes:Number(stmt.run(...args).changes)}}}};
    },
    batch(stmts){
      sqlite.exec('BEGIN');
      try{const outputs=stmts.map(x=>x.run());sqlite.exec('COMMIT');return outputs}
      catch(e){sqlite.exec('ROLLBACK');throw e}
    }
  };
  return {sqlite,env:{DB:db}};
}
const member={id:'member_001'};
const request=(path,data)=>new Request(url+path,data?{method:'POST',headers:{origin:url,'content-type':'application/json'},body:JSON.stringify(data)}:{});
const deps={scrub:x=>x,currentMember:async()=>member,requireMember:async()=>({member}),readJson:r=>r.json(),hosts:['yukvinc.com.tr']};
test('board uses own machines, drops duplicate/cancelled/expired tenders and reacts to live listing edits',async()=>{
  const {sqlite,env}=fixture();
  const guest=await boardData(env,null);
  assert.deepEqual(guest.opportunities.map(x=>x.id),['lead_good_01','lead_high_01']);
  assert.equal(guest.machines.length,0);
  let view=await boardData(env,member);
  assert.equal(view.machines.length,2);
  assert.equal(view.opportunities[0].matches[0].machine,'listing_001');
  assert.equal(view.opportunities[1].matches.length,0);
  sqlite.exec("UPDATE listings SET title='70 tonluk mobil vinç' WHERE id='listing_001'");
  view=await boardData(env,member);
  assert.equal(view.opportunities[1].matches[0].machine,'listing_001');
  assert.equal((await tenderApi({env,request:request('/api/v12/tenders',{id:'lead_good_01',saved:true})},deps)).status,200);
  assert.equal((await boardData(env,member)).opportunities[0].saved,true);
  assert.equal((await boardData(env,{id:'member_002'})).opportunities[0].saved,false);
  sqlite.close();
});
test('AI failure falls back to document-linked rules',async()=>{
  const {sqlite,env}=fixture();
  env.V12_AI_ENABLED='true';env.V12_AI_MODEL='fixture';env.AI={run(){throw Error('Unavailable')}};
  const out=await guideTender({env,request:request('/api/v12/tender-guide',{id:'lead_good_01'})},deps);
  assert.equal((await out.json()).mode,'rules');
  sqlite.close();
});
test('guardian lease prevents overlap, records an incident and denies unauthorized access',async()=>{
  const {sqlite,env}=fixture();
  const results=await Promise.all([runGuardian(env),runGuardian(env)]);
  assert.deepEqual(results.sort(),[false,true]);
  assert.equal(sqlite.prepare('SELECT service FROM v12_guardian_incidents').get().service,'radar_sources');
  assert.equal((await guardianApi({request:request('/admin/api/v12/guardian'),env},async()=>({response:new Response(null,{status:401})}))).status,401);
  sqlite.close();
});
test('notifications require consent, deduplicate and do not resend uncertain delivery',async()=>{
  const {sqlite,env}=fixture();
  await scanTenderAlerts(env);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM v12_tender_alerts').get().n,0);
  await notificationApi({env,request:request('/api/v12/tender-alerts',{site:true,email:true})},deps);
  sqlite.exec("UPDATE v12_tender_scan SET next_at=0");
  await scanTenderAlerts(env);
  sqlite.exec("UPDATE v12_tender_scan SET next_at=0");
  await scanTenderAlerts(env);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM v12_tender_alerts').get().n,1);
  let sends=0;
  env.EMAIL={send(){sends++;throw Error('Unknown delivery')}};
  env.LISTING_NOTIFICATION_FROM='sender@site.test';
  await sendTenderAlerts(env);await sendTenderAlerts(env);
  assert.equal(sends,1);
  assert.equal(sqlite.prepare('SELECT state FROM v12_tender_alerts').get().state,'uncertain');
  sqlite.close();
});
test('feature flags delegate legacy routes and gate all new APIs',async()=>{
  const base={fetch:r=>new Response(new URL(r.url).pathname),scheduled(){}};
  const worker=createV12Worker(base,deps,{board:'',guardian:''});
  for(const path of ['/','/assets/site.css','/api/auth/google','/api/account-renewals','/api/listing-contact/listing_001/call']){
    assert.equal(await (await worker.fetch(request(path),{},{})).text(),path);
  }
  assert.equal((await worker.fetch(request('/api/v12/tenders'),{},{})).status,404);
  assert.equal((await worker.fetch(request('/admin/api/v12/guardian'),{},{})).status,404);
});
