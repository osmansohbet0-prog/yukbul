import test from 'node:test';
import assert from 'node:assert/strict';
import {aiReview,reviewListingInBackground} from '../functions/_lib/listings.js';
import {onRequestGet as photoGet} from '../functions/api/listing-photo/[id].js';

const item={title:'Forklift kiralama',description:'Güncel forklift kiralama hizmeti.',category:'machine',city:'Adıyaman',district:'Gölbaşı',price_amount:5000};
function fixture({visionFailure=false}={}){
 const writes=[],emails=[],models=[];
 const db={prepare(sql){return{args:[],bind(...args){this.args=args;return this},async first(){
  if(sql.includes('SELECT status,moderation_note'))return{status:'pending',title:item.title,city:item.city,district:item.district,moderation_note:null};
  return null;
 },async all(){return{results:sql.includes('SELECT mime_type,image_blob')?[{mime_type:'image/webp',image_blob:new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80])}]:[]}},async run(){
  writes.push({sql,args:this.args});return{meta:{changes:sql.startsWith('UPDATE ai_usage')?0:1}};
 }}}};
 const env={DB:db,AI_ENABLED:'true',ADMIN_EMAIL:'admin@example.test',LISTING_NOTIFICATION_FROM:'notify@example.test',EMAIL:{async send(value){emails.push(value)}},AI:{async run(model){
  models.push(model);
  if(model.includes('moondream'))return{};
  if(model.includes('llava')){if(visionFailure)throw Error('outage');return{description:'A cat is beside a window. No industrial equipment or transport vehicle is visible.'}}
  if(model.includes('resnet'))return[{label:'TIGER CAT',score:.8}];
  return{response:'{"suspicious":false,"duplicate":false,"reason":"Metin uygun."}'};
 }}};
 return{env,writes,emails,models};
}
test('mandatory image review runs even when shared optional AI quota is exhausted',async()=>{
 const f=fixture(),r=await aiReview(f.env,f.env.DB,'member-1',item,'listing_123456');
 assert.equal(r.reviewed,true);assert.equal(r.images_reviewed,1);assert.equal(r.suspicious,true);
 assert.ok(f.models.some(x=>x.includes('llava')));assert.ok(f.models.some(x=>x.includes('resnet')));
 assert.ok(f.writes.filter(x=>x.sql.startsWith('UPDATE ai_usage')).every(x=>!x.sql.includes('count<5')));
});
test('animal-only photo flags the listing and sends an admin warning even when text model returns clean',async()=>{
 const f=fixture(),r=await reviewListingInBackground(f.env,'listing_123456','member-1',item);
 assert.equal(r.suspicious,true);
 assert.ok(f.writes.some(x=>x.sql.includes("SET status='flagged'")));
 assert.equal(f.emails.length,1);assert.match(f.emails[0].subject,/YükUsta uyarısı/);
});
test('empty primary and failed backup vision never record the image as reviewed',async()=>{
 const f=fixture({visionFailure:true}),r=await reviewListingInBackground(f.env,'listing_123456','member-1',item);
 assert.equal(r.images_reviewed,0);assert.equal(r.images_failed,1);
 assert.ok(f.writes.some(x=>x.sql.includes("SET status='flagged'")));
 assert.equal(f.emails.length,1);
});
function photoContext(authenticated){
 return{params:{id:'photo_123456'},request:new Request('https://yukvinc.com.tr/api/listing-photo/photo_123456',{headers:authenticated?{cookie:'__Host-yv_admin=admin-session'}:{}}),env:{ADMIN_EMAIL:'admin@example.test',DB:{prepare(sql){return{bind(){return this},async first(){
 if(sql.includes('FROM listing_photos'))return{mime_type:'image/webp',image_blob:[82,73,70,70],listing_id:'listing_123456',status:'pending',user_id:'owner-1'};
 if(sql.includes('admin_sessions'))return{id:'admin-1',role:'admin',email:'admin@example.test'};
 return null;
 }}}}}};
}
test('admin can preview pending images with private no-store caching',async()=>{
 const r=await photoGet(photoContext(true));assert.equal(r.status,200);
 assert.equal(r.headers.get('cache-control'),'private, no-store');
});
test('pending listing images remain inaccessible without authentication',async()=>{
 assert.equal((await photoGet(photoContext(false))).status,404);
});
