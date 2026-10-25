import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteD1} from './fixtures/sqlite-d1.mjs';
import {digest} from '../functions/_lib/member.js';
import {onRequestPost as create} from '../functions/api/listings/index.js';
import {onRequestPatch as edit} from '../functions/api/listings/[id].js';
import {onRequestGet as adminQueue,onRequestPatch as moderate} from '../functions/api/admin-moderation.js';
import {onRequestPatch as adminDecision} from '../functions/api/admin-listings.js';
import {onRequestPost as priceCheck} from '../functions/api/listings/price-check.js';
const listing={category:'crane',listing_type:'equipment',title:'25 ton mobil vinç kiralama',description:'Konya Meram ilçesinde mobil vinç kiralama hizmeti veriyoruz.',city:'Konya',district:'Meram',price_amount:1,price_unit:'günlük',contact_phone:'05551234567'};
async function setup(){const db=sqliteD1();db.sqlite.exec("INSERT INTO users(id,email,email_norm,role) VALUES('member_123456','member@example.test','member@example.test','member'),('admin_123456','admin@example.test','admin@example.test','admin');");
 await db.prepare('INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)').bind(await digest('member-session'),'member_123456').run();await db.prepare('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)').bind(await digest('admin-session'),'admin_123456').run();return{DB:db,ADMIN_EMAIL:'admin@example.test',AI_ENABLED:'false'};
}
function context(env,path,body,admin=false,method=body?'POST':'GET'){
 const waiting=[],request=new Request('https://yukvinc.com.tr'+path,{method,headers:{origin:'https://yukvinc.com.tr','content-type':'application/json',cookie:admin?'__Host-yv_admin=admin-session':'__Host-yv_member=member-session'},...(body?{body:JSON.stringify(body)}:{})});return{request,env,params:{id:path.split('/').at(-1)},ctx:{waitUntil(p){waiting.push(p)}},waiting};
}
test('real SQLite contract: low price is accepted privately, appeal and admin decision are audited',async()=>{
 const env=await setup();try{
 const ctx=context(env,'/api/listings',{listing,privacy_ok:true,photos:[]});const response=await create(ctx);await Promise.all(ctx.waiting);assert.equal(response.status,201);const data=await response.json();assert.equal(data.status,'flagged');
 const saved=env.DB.sqlite.prepare('SELECT * FROM listings WHERE id=?').get(data.id);assert.equal(saved.price_amount,1);assert.equal(saved.status,'flagged');
 const queue=await (await adminQueue(context(env,'/api/admin-moderation',null,true))).json();assert.equal(queue.items.length,1);assert.ok(queue.items[0].risk_score>=40);assert.match(queue.items[0].owner_email,/\*\*\*/);assert.doesNotMatch(JSON.stringify(queue),/05551234567|member@example/);
 const appealed=await edit(context(env,'/api/listings/'+data.id,{action:'appeal',message:'Bu fiyatı yanlış yazdım, düzelteceğim.'},false,'PATCH'));assert.equal(appealed.status,200);
 const correction=await moderate(context(env,'/api/admin-moderation',{id:data.id,action:'request_correction',note:'Lütfen gerçek hizmet ücretinizi açıklayın.'},true,'PATCH'));assert.equal(correction.status,200);
 const approved=await adminDecision(context(env,'/api/admin-listings',{id:data.id,status:'approved',note:'Yönetici kontrol etti.'},true,'PATCH'));assert.equal(approved.status,200);assert.equal(env.DB.sqlite.prepare('SELECT status FROM listings WHERE id=?').get(data.id).status,'approved');assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM admin_activity WHERE action='listing.status.update'").get().n,1);
 }finally{env.DB.sqlite.close()}
});
test('price checks use separate quota and do not consume listing submissions',async()=>{
 const env=await setup();try{for(let i=0;i<10;i++){const r=await priceCheck(context(env,'/api/listings/price-check',{listing}));assert.equal(r.status,200);assert.match((await r.json()).comparison.warning,/Yetersiz veri/)}assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) n FROM user_login_attempts WHERE action='listing'").get().n,0)}finally{env.DB.sqlite.close()}
});
