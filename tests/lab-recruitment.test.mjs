import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {digest} from '../functions/_lib/core.js';
import * as lab from '../functions/_lib/lab-recruitment.js';
const now=Math.floor(Date.parse('2026-11-02T10:00:00+03:00')/1000);
const page=(tail='Son başvuru tarihi: 13 Kasım 2026 17:00')=>'<h1>Tıbbi Laboratuvar Teknikeri Personel Alımı</h1><article>Nevşehir hastanemize tıbbi laboratuvar teknikeri alınacaktır. '+tail+'</article>';
test('medical recruitment uses exact future deadline, Turkish timezone, role and location evidence',()=>{
 const r=lab.analyzeLabJob(page(),{now,url:'https://example.edu.tr/jobs/1'});assert.equal(r.status,'open');assert.equal(r.city,'Nevşehir');assert.equal(r.deadline,Date.parse('2026-11-13T17:00:00+03:00')/1000);assert.ok(r.evidence.length);assert.equal(r.published_at,null);
});
test('past dates, invalid dates, missing deadlines and conflicting dates never appear open',()=>{
 assert.equal(lab.analyzeLabJob(page('Son başvuru tarihi: 1 Kasım 2026'),{now}).status,'closed');
 for(const tail of ['Başvurular devam ediyor.','Son başvuru tarihi: 31 Şubat 2027','Son başvuru: 13.11.2026 Son başvuru: 14.11.2026'])assert.equal(lab.analyzeLabJob(page(tail),{now}).status,'unverified',tail);
 assert.equal(lab.labDeadline('Son başvuru: 13.11.2026').at,Date.parse('2026-11-13T23:59:59+03:00')/1000);
});
test('results, academic jobs, equipment purchases, nonmedical labs and general CV forms are excluded',()=>{
 for(const title of ['Tıbbi laboratuvar personel alımı yedek aday duyurusu','Tıbbi laboratuvar teknikeri alım sonuçları','Tıbbi laboratuvar öğretim görevlisi alımı','Laboratuvar cihaz alımı ihalesi','Genel başvuru — tıbbi laboratuvar teknikeri'])assert.equal(lab.analyzeLabJob('<h1>'+title+'</h1><p>Tıbbi laboratuvar teknikeri personel alımı Son başvuru: 13.11.2026</p>',{now}).status,'not_relevant',title);
 assert.equal(lab.analyzeLabJob('<h1>Beton laboratuvar teknikeri iş ilanı</h1><p>Son başvuru: 13.11.2026</p>',{now}).status,'not_relevant');
});
test('JobPosting metadata supports exact dates but multiple jobs and future starts are not open',()=>{
 const job={'@type':'JobPosting',title:'Tıbbi Laboratuvar Teknikeri İş İlanı',description:'Hastanemize tıbbi laboratuvar teknikeri alınacaktır.',datePosted:'2026-11-01',validThrough:'2026-11-13',hiringOrganization:{name:'Test hastanesi'}};
 const html=o=>'<script type="application/ld+json">'+JSON.stringify(o)+'</script>';
 assert.equal(lab.analyzeLabJob(html(job),{now}).status,'open');
 assert.equal(lab.analyzeLabJob(html({...job,datePosted:'2026-11-20'}),{now}).status,'unverified');
 assert.equal(lab.analyzeLabJob(html([job,job])+page(),{now}).status,'unverified');
});
test('source URLs and discovered links cannot escape institution or reach private targets',()=>{
 for(const u of ['http://example.edu.tr/','https://localhost/','https://127.0.0.1/','https://example.edu.tr.evil.com/','https://x:secret@example.edu.tr/','https://example.edu.tr:444/'])assert.equal(lab.labUrl(u),null);
 const rows=lab.labCandidates('<a href="https://evil.gov.tr/a">Tıbbi laboratuvar alımı</a><a href="/job">Laboratuvar Teknikeri</a><a href="/job">Laboratuvar Teknikeri</a><a href="/result">Personel alım sonuçları</a>','https://example.edu.tr/list');assert.equal(rows.length,1);assert.equal(rows[0].url,'https://example.edu.tr/job');
});
function fixture(){const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE users(id TEXT,email TEXT,email_norm TEXT,role TEXT,active INTEGER);CREATE TABLE admin_sessions(token_hash TEXT,user_id TEXT,expires_at INTEGER);CREATE TABLE ai_model_budget(day TEXT,actor TEXT,calls INTEGER,PRIMARY KEY(day,actor));`);sql.exec(readFileSync(new URL('../migrations/0030_admin_lab_recruitment.sql',import.meta.url),'utf8'));const env={ADMIN_EMAIL:'owner@example.org',DB:{prepare(q){let args=[];return {bind(...a){args=a;return this},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return {meta:{changes:Number(sql.prepare(q).run(...args).changes)}}}}}}};return {sql,env};}
async function login(sql){sql.prepare('INSERT INTO users VALUES(?,?,?,?,1)').run('a','owner@example.org','owner@example.org','admin');sql.prepare('INSERT INTO admin_sessions VALUES(?,?,?)').run(await digest('lab-session'),'a',Math.floor(Date.now()/1000)+3600);}
function request(method='GET',body,cookie=true,origin='https://yukvinc.com.tr',query=''){return new Request('https://yukvinc.com.tr/api/lab-recruitment'+query,{method,headers:{'content-type':'application/json',origin,...(cookie?{cookie:'__Host-yv_admin=lab-session'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
test('real session guards read, scan and source mutation before external requests',async()=>{
 const {sql,env}=fixture();await login(sql);
 assert.equal((await lab.onRequestGet({request:request('GET',null,false),env})).status,401);
 assert.equal((await lab.onRequestPost({request:request('POST',{action:'scan'},false),env})).status,401);
 assert.equal((await lab.onRequestPost({request:request('POST',{action:'scan'},true,'https://evil.test'),env})).status,403);
 sql.exec("UPDATE users SET role='member'");assert.equal((await lab.onRequestGet({request:request(),env})).status,401);
});
test('scanner persists isolated records, checks robots, uses lock and respects source interval',async()=>{
 // This test exercises one source's lease; other seeded institutions are independent.
 const {sql,env}=fixture();let calls=0;const future=new Date(Date.now()+86400000).toISOString().slice(0,10).split('-').reverse().join('.');
 sql.exec("DELETE FROM lab_recruitment_sources WHERE id!='kapadokya-career'");
 const fetcher=async u=>{calls++;u=String(u);return new Response(u.endsWith('/robots.txt')?'User-agent: *\nAllow: /':u.endsWith('/is-ilanlari/')?'<a href="/lab-job">Tıbbi laboratuvar personel alımı</a>':page('Son başvuru: '+future),{headers:{'content-type':u.endsWith('/robots.txt')?'text/plain':'text/html'}});};
 const r=await lab.scanLabRecruitment(env,{fetcher});assert.equal(r.reviewed,1);assert.equal(sql.prepare('SELECT status FROM lab_recruitment_jobs').get().status,'open');const before=calls;assert.equal((await lab.scanLabRecruitment(env,{fetcher})).scanned,0);assert.equal(calls,before);
 assert.equal(sql.prepare("SELECT count(*) n FROM sqlite_master WHERE name IN ('lead_radar_leads','job_requests')").get().n,0);
});
test('robots disallow makes source error without reading jobs',async()=>{
 const {sql,env}=fixture();let calls=0;await lab.scanLabRecruitment(env,{fetcher:async()=>{calls++;return new Response('User-agent: *\nDisallow: /',{headers:{'content-type':'text/plain'}});}});assert.equal(calls,1);assert.equal(sql.prepare('SELECT last_status FROM lab_recruitment_sources').get().last_status,'error');
});
test('open view excludes expired or stale records even without another scan',async()=>{
 const {sql,env}=fixture();await login(sql);const time=Math.floor(Date.now()/1000);
 for(const [id,deadline,checked] of [['past',time-1,time],['stale',time+86400,time-86401],['valid',time+86400,time]])sql.prepare("INSERT INTO lab_recruitment_jobs(id,source_id,source_url,title,deadline,status,checked_at) VALUES(?,'kapadokya-career',?, ?,?,'open',?)").run(id,'https://example.edu.tr/'+id,id,deadline,checked);
 const d=await(await lab.onRequestGet({request:request(),env})).json();assert.equal(d.items.length,1);assert.equal(d.items[0].id,'valid');assert.equal(d.visibility,'admin_only');assert.equal(d.summary.closed,1);assert.equal(d.summary.unverified,1);
});
test('AI cannot create facts or override deadline, invalid evidence is rejected',async()=>{
 const {env}=fixture();env.AI_ENABLED='true';env.AI={run:async()=>({response:'{"items":[{"index":0,"relevant":true,"evidenceIndex":99}]} '})};
 const r=await lab.aiLabAssessment(env,[{title:'Tıbbi laboratuvar',evidence:['Hastaneye laborant alımı']}]);assert.equal(r.state,'unavailable');assert.equal(r.notes.size,0);
 env.AI.run=async()=>({response:'{"items":[{"index":0,"relevant":true,"evidenceIndex":0}]}'});assert.equal((await lab.aiLabAssessment(env,[{title:'Tıbbi laboratuvar',evidence:['Hastaneye laborant alımı']}])).state,'checked');
});
test('structured AI objects and chat response envelopes are both validated',async()=>{
 const {env}=fixture();env.AI_ENABLED='true';const rows=[{title:'Tıbbi laboratuvar',evidence:['Hastaneye laborant alımı']}],response={items:[{index:0,relevant:true,evidenceIndex:0}]};
 for(const result of [{response},{choices:[{message:{content:JSON.stringify(response)}}]}]){env.AI={run:async(_model,input)=>{assert.equal(input.response_format.type,'json_schema');return result;}};assert.equal((await lab.aiLabAssessment(env,rows)).state,'checked');}
});
test('one AI retry does not refetch pages, publish a job or refresh source verification',async()=>{
 const {sql,env}=fixture(),at=Math.floor(Date.now()/1000);sql.exec('UPDATE lab_recruitment_sources SET last_scan_at=unixepoch()');
 sql.prepare("INSERT INTO lab_recruitment_jobs(id,source_id,source_url,title,status,evidence_json,ai_status,checked_at) VALUES('retry','kapadokya-career','https://example.edu.tr/retry','Laborant alımı','unverified',?,'unavailable',?)").run(JSON.stringify(['Hastaneye laborant alımı']),at);
 env.AI_ENABLED='true';env.AI={run:async()=>({response:{items:[{index:0,relevant:true,evidenceIndex:0}]}})};
 const r=await lab.scanLabRecruitment(env,{fetcher:()=>{throw Error('No page request expected');}});assert.equal(r.aiState,'checked');const row=sql.prepare("SELECT status,ai_status,checked_at FROM lab_recruitment_jobs WHERE id='retry'").get();assert.equal(row.status,'unverified');assert.equal(row.ai_status,'checked');assert.equal(row.checked_at,at);
 assert.equal((await lab.scanLabRecruitment(env)).aiRetried,undefined);
});
