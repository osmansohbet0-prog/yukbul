import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {withSitePerformance} from './site-performance.mjs';

function setup(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,company_name TEXT,display_name TEXT);
 CREATE TABLE listings(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,status TEXT,member_paused_at INTEGER,created_at INTEGER,trial_expires_at INTEGER,paid_until INTEGER);
 CREATE TABLE listing_metrics_daily(listing_id TEXT,day TEXT,kind TEXT,count INTEGER,PRIMARY KEY(listing_id,day,kind));`);
 sqlite.exec(readFileSync(new URL('./site-migration.sql',import.meta.url),'utf8'));
 sqlite.prepare('INSERT INTO users(id,company_name) VALUES(?,?)').run('owner-a','A Firma');sqlite.prepare('INSERT INTO users(id,company_name) VALUES(?,?)').run('owner-b','B Firma');
 const now=Math.floor(Date.now()/1000),date=new Date().toISOString().slice(0,10);
 for(const [id,owner] of [['listing-aa','owner-a'],['listing-bb','owner-b']])sqlite.prepare('INSERT INTO listings(id,user_id,title,status,created_at,paid_until) VALUES(?,?,?,?,?,?)').run(id,owner,id,'approved',now-100,now+86400);
 sqlite.prepare('INSERT INTO listing_metrics_daily VALUES(?,?,?,?)').run('listing-aa',date,'view',12);
 sqlite.prepare('INSERT INTO listing_metrics_daily VALUES(?,?,?,?)').run('listing-bb',date,'view',99);
 const db={prepare(sql){const statement=sqlite.prepare(sql);let params=[];return{bind(...values){params=values;return this},async first(){return statement.get(...params)||null},async all(){return{results:statement.all(...params)}},async run(){const r=statement.run(...params);return{meta:{changes:Number(r.changes)}}}}},async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 const base={async fetch(request){const path=new URL(request.url).pathname;if(path==='/api/listing-event')return Response.json({ok:true,measured:true});if(path.startsWith('/api/listing-contact/'))return new Response(null,{status:302,headers:{location:'https://wa.me/905451612942'}});return new Response('ok',{headers:{'content-type':'text/plain'}})},async scheduled(){}};
 const worker=withSitePerformance(base,{currentMember:async request=>request.headers.get('x-member')?{id:request.headers.get('x-member')}:null,adminAccess:async()=>({admin:{id:'admin'}})},'');
 return {sqlite,db,worker};
}
const req=(path,member,options={})=>new Request('https://yukvinc.com.tr'+path,{...options,headers:{...(options.headers||{}),'x-member':member||''}});
test('only the owner sees actual listing metrics',async()=>{const {db,worker}=setup();let res=await worker.fetch(req('/api/account-performance?period=today','owner-a'),{DB:db},{});assert.equal(res.status,200);let data=await res.json();assert.equal(data.totals.views,12);assert.deepEqual(data.items.map(x=>x.id),['listing-aa']);res=await worker.fetch(req('/api/account-performance?listing=listing-bb','owner-a'),{DB:db},{});assert.equal(res.status,404);res=await worker.fetch(req('/api/account-performance',''),{DB:db},{});assert.equal(res.status,401)});
test('favorites count a new addition once and stay private',async()=>{const {db,worker}=setup();for(let i=0;i<2;i++){const r=await worker.fetch(req('/api/account-favorites','owner-a',{method:'POST',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json'},body:JSON.stringify({id:'listing-aa',save:true})}),{DB:db},{});assert.equal(r.status,200)}const data=await (await worker.fetch(req('/api/account-performance?period=today','owner-a'),{DB:db},{})).json();assert.equal(data.totals.favoriteAdds,1);assert.equal(data.items[0].activeFavorites,1)});
test('contact redirect keeps working, prepares WhatsApp text, and deduplicates notifications',async()=>{const {db,worker,sqlite}=setup();const env={DB:db,METRICS_HASH_KEY:'local-test-key'};const headers={'user-agent':'Mozilla/5.0','cf-connecting-ip':'192.0.2.5'};for(let i=0;i<2;i++){const pending=[],ctx={waitUntil:p=>pending.push(p)};const r=await worker.fetch(new Request('https://yukvinc.com.tr/api/listing-contact/listing-aa/whatsapp',{headers}),env,ctx);assert.equal(r.status,302);assert.match(r.headers.get('location'),/text=Merhaba/);await Promise.all(pending)}assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM v2221_interactions').get().n,1)});
test('unique visitor starts counting real view events without double counting',async()=>{const {db,worker,sqlite}=setup();const env={DB:db,METRICS_HASH_KEY:'local-test-key'};for(let i=0;i<2;i++){const pending=[],ctx={waitUntil:p=>pending.push(p)};await worker.fetch(new Request('https://yukvinc.com.tr/api/listing-event',{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0','cf-connecting-ip':'192.0.2.5'},body:JSON.stringify({id:'listing-aa',kind:'view'})}),env,ctx);await Promise.all(pending)}assert.equal(sqlite.prepare('SELECT visitors FROM v2221_unique_daily').get().visitors,1)});
test('administrator receives listing and company summaries',async()=>{const {db,worker}=setup();const response=await worker.fetch(req('/admin/api/site-performance?days=1',''),{DB:db},{});assert.equal(response.status,200);const data=await response.json();assert.equal(data.listings.length,2);assert.equal(data.companies.length,2);assert.equal(data.companies.find(x=>x.id==='owner-a').views,12)});

