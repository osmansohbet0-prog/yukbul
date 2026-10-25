import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sqliteD1} from './fixtures/sqlite-d1.mjs';
import {digest} from '../functions/_lib/member.js';
import {validateListing,publicItems} from '../functions/_lib/listings.js';
import {searchIntent} from '../functions/_lib/ai-search.js';
import {onRequestPost as adminCreate,onRequestPatch as adminEdit} from '../functions/api/admin-listings.js';
import {onRequestPost as memberCreate} from '../functions/api/listings/index.js';
import {onRequestPatch as memberEdit} from '../functions/api/listings/[id].js';
import {onRequestGet as mine} from '../functions/api/listings/mine.js';
import {onRequestGet as categoryPage} from '../functions/kategori/[slug].js';
import {onRequestGet as listingPage} from '../functions/ilan/[id].js';
import {onRequestGet as sitemap} from '../functions/sitemap.xml.js';
const fields={category:'mobile_tire',listing_type:'equipment',title:'Mobil lastikçi ve yerinde lastik tamiri',description:'Konya Meram bölgesinde araçlı mobil lastik tamiri ve yerinde lastik değişimi hizmeti verilir.',city:'Konya',district:'Meram',contact_phone:'05551234567',price_amount:1500,price_unit:'sefer'};
async function setup(){const DB=sqliteD1();DB.sqlite.exec("INSERT INTO users(id,email,email_norm,role) VALUES('admin_123456','admin@example.test','admin@example.test','admin'),('member_123456','member@example.test','member@example.test','member')");for(const type of ['admin','member'])await DB.prepare(`INSERT INTO ${type==='admin'?'admin':'user'}_sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+3600)`).bind(await digest(type+'-session'),type+'_123456').run();return{DB,ADMIN_EMAIL:'admin@example.test',AI_ENABLED:'false'}}
function ctx(env,body,path='/api/admin-listings',method=body?'POST':'GET',admin=true){const waiting=[];return{env,params:{id:path.split('/').at(-1)},waiting,ctx:{waitUntil(p){waiting.push(p)}},request:new Request('https://yukvinc.com.tr'+path,{method,headers:{origin:'https://yukvinc.com.tr','content-type':'application/json',cookie:admin?'__Host-yv_admin=admin-session':'__Host-yv_member=member-session'},...(body?{body:JSON.stringify(body)}:{})})}}
test('mobile tire service is accepted and is recognized before generic roadside assistance',()=>{assert.equal(validateListing(fields),null);for(const text of ['Konya mobil lastikçi','yerinde lastik tamiri yol yardım','Gebze lastik değişimi'])assert.equal(searchIntent(text).category,'mobile_tire');assert.equal(searchIntent('Konya oto kurtarıcı').category,'tow')});
test('admin mobile tire create/edit keeps separate category, photo, public page and sitemap',async()=>{const env=await setup();try{
 const png=readFileSync(new URL('../public/assets/yuk-vinc-logo-192.png',import.meta.url));const r=await adminCreate(ctx(env,{fields,photos:[{mime_type:'image/png',data:png.toString('base64')}]}));assert.equal(r.status,201);const{id}=await r.json();let stored=env.DB.sqlite.prepare('SELECT category,category_detail,service_category FROM listings WHERE id=?').get(id);assert.deepEqual({...stored},{category:'tow',category_detail:null,service_category:'mobile_tire'});
 let items=await publicItems(env.DB,{category:'mobile_tire'});assert.equal(items.length,1);assert.equal(items[0].category,'mobile_tire');assert.ok(items[0].photo_url);assert.equal((await publicItems(env.DB,{category:'tow'})).length,0);assert.equal((await publicItems(env.DB,{q:'lastikçi'})).length,1);
 const page=await categoryPage({env,params:{slug:'mobil-lastikci'}});assert.equal(page.status,200);const html=await page.text();assert.match(html,/Mobil lastikçi ve yerinde lastik tamiri/);assert.match(html,/<h1>Mobil lastikçi<\/h1>/);assert.match(html,/api\/listing-photo/);assert.match(html,/index,follow/);
 const detail=await listingPage({env,params:{id,slug:'mobil-lastikci-ve-yerinde-lastik-tamiri'}});assert.equal(detail.status,200);assert.match(await detail.text(),/Yerinde lastik tamiri hizmeti/);assert.match(await(await sitemap({env})).text(),/kategori\/mobil-lastikci/);
 const edited=await adminEdit(ctx(env,{id,fields:{...fields,title:'Araçlı lastik yol yardım hizmeti'}},'/api/admin-listings','PATCH'));assert.equal(edited.status,200);assert.equal((await publicItems(env.DB,{category:'mobile_tire'}))[0].category,'mobile_tire');
 }finally{env.DB.sqlite.close()}});
test('members can create and edit mobile tire listings while publication still requires admin approval',async()=>{const env=await setup();try{
 const c=ctx(env,{listing:fields,photos:[],privacy_ok:true},'/api/listings','POST',false),r=await memberCreate(c);await Promise.all(c.waiting);assert.equal(r.status,201);const{id}=await r.json();assert.equal((await publicItems(env.DB,{category:'mobile_tire'})).length,0);
 let own=await(await mine(ctx(env,null,'/api/listings/mine','GET',false))).json();assert.equal(own.items[0].category,'mobile_tire');
 const editCtx=ctx(env,{listing:{...fields,title:'Konya araçlı mobil lastikçi'},privacy_ok:true},'/api/listings/'+id,'PATCH',false);const edited=await memberEdit(editCtx);await Promise.all(editCtx.waiting);assert.equal(edited.status,200);assert.equal(env.DB.sqlite.prepare('SELECT service_category FROM listings WHERE id=?').get(id).service_category,'mobile_tire');
 const approved=await adminEdit(ctx(env,{id,status:'approved'},'/api/admin-listings','PATCH'));assert.equal(approved.status,200);assert.equal((await publicItems(env.DB,{category:'mobile_tire'})).length,1);
 }finally{env.DB.sqlite.close()}});
test('public navigation and both listing forms offer the mobile tire category',()=>{for(const path of ['public/assets/sidebar.js','public/admin/index.html','public/ilan-ver/index.html'])assert.match(readFileSync(new URL('../'+path,import.meta.url),'utf8'),/mobile_tire/);assert.match(readFileSync(new URL('../public/assets/sidebar.js',import.meta.url),'utf8'),/kategori\/mobil-lastikci/)});
