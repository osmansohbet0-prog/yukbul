import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {DatabaseSync} from 'node:sqlite';
test('deployed adapter preserves public and crane routes and protects university administration',async()=>{
 const output=await build({entryPoints:[new URL('../src/university-worker.js',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],bundle:true,format:'esm',platform:'browser',write:false});
 const old=readFileSync(new URL('../src/production-baseline.mjs',import.meta.url),'utf8').split('\n// Adapter exports only;')[0];
 const workers=[['candidate',output.outputFiles[0].text],['baseline',old]].map(([name,script])=>({name,modules:true,script,compatibilityDate:'2026-10-23',d1Databases:{DB:name},bindings:{ADMIN_EMAIL:'admin@example.invalid',AI_ENABLED:'false'},serviceBindings:{ASSETS:()=>new Response('asset fallback',{status:404})}}));
 const mf=new Miniflare(convertV4MiniflareOptions({cf:false,workers}));
 try{
  const schema=new DatabaseSync(':memory:');schema.exec(readFileSync(new URL('./fixtures/live-radar-schema.sql',import.meta.url),'utf8'));schema.exec(readFileSync(new URL('../migrations/0016_university_radar.sql',import.meta.url),'utf8'));
  const dbs=[];for(const name of ['candidate','baseline']){
   const db=await mf.getD1Database('DB',name);dbs.push(db);
   for(const r of schema.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE WHEN type='table' THEN 0 ELSE 1 END").all())await db.prepare(r.sql).run();
   await db.prepare("INSERT INTO users(id,email,email_norm,role,active) VALUES('admin','admin@example.invalid','admin@example.invalid','admin',1)").run();
   await db.prepare("INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES(?,'admin',unixepoch()+3600)").bind(createHash('sha256').update('university-fixture').digest('hex')).run();
  }
  const candidate=await mf.getWorker('candidate'),baseline=await mf.getWorker('baseline');
  const get=(w,path,auth=false)=>w.fetch('https://yukvinc.com.tr'+path,{headers:auth?{cookie:'__Host-yv_admin=university-fixture'}:{}});
  for(const path of ['/api/saglik','/api/listings','/api/public-settings','/api/lead-radar','/api/lab-recruitment','/api/admin-session']){
   const a=await get(candidate,path),b=await get(baseline,path);assert.equal(a.status,b.status,path);assert.equal(await a.text(),await b.text(),path);
  }
  assert.equal((await get(candidate,'/api/university-radar')).status,401);
  assert.equal((await get(candidate,'/admin/universiteler/')).status,401);
  const admin=await get(candidate,'/admin/universiteler/',true);assert.equal(admin.status,200);assert.equal(admin.headers.get('cache-control'),'no-store');assert.ok((await admin.text()).includes('Üniversite personel ilanları'));
  const api=await get(candidate,'/api/university-radar',true);assert.equal(api.status,200);assert.equal((await api.json()).summary.universities,0);
  const write=await candidate.fetch('https://yukvinc.com.tr/api/university-radar',{method:'POST'});assert.equal(write.status,405);
  schema.close();
 }finally{await mf.dispose();}
});

