import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPatch} from '../functions/api/admin-listings.js';
import {onRequestPost as aiPost} from '../functions/api/admin-ai.js';

function fixture(body,{ai=false,cookie=true}={}){
 const writes=[],calls=[];
 const DB={prepare(sql){return{args:[],bind(...args){this.args=args;return this},async first(){
 if(sql.includes('admin_sessions'))return{id:'admin-1',email:'admin@example.test',role:'admin'};
 if(sql.includes('FROM listings'))return{id:'listing_123456',status:'rejected',title:'Vinç ilanı',description:'Güncel vinç kiralama hizmeti',category:'crane',moderation_note:'Fotoğraf yetersiz',city:'Konya'};
 return null;
 },async all(){return{results:[]}},async run(){writes.push({sql,args:this.args});return{meta:{changes:1}}}}}};
 const request=new Request('https://yukvinc.com.tr/api/'+(ai?'admin-ai':'admin-listings'),{method:ai?'POST':'PATCH',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json',...(cookie?{cookie:'__Host-yv_admin=admin-session'}:{})},body:JSON.stringify(body)});
 return{context:{request,env:{DB,ADMIN_EMAIL:'admin@example.test',AI_ENABLED:'true',AI:{async run(model,input){calls.push(input);return{response:'Fotoğraflar ekipmanı yeterince göstermiyor. Net fotoğraflar ekleyerek yeniden gönderin.'}}}}},writes,calls};
}
test('rejection requires a reason and never changes the listing on an empty reason',async()=>{
 const f=fixture({id:'listing_123456',status:'rejected',note:' '});
 const r=await onRequestPatch(f.context);
 assert.equal(r.status,400);assert.equal(f.writes.length,0);
});
test('existing rejected listing reason can be edited and is recorded in audit',async()=>{
 const note='Yeni ve net ekipman fotoğrafları ekleyerek tekrar gönderin.';
 const f=fixture({id:'listing_123456',status:'rejected',note});
 const r=await onRequestPatch(f.context);assert.equal(r.status,200);
 const update=f.writes.find(x=>x.sql.startsWith('UPDATE listings SET status'));
 assert.equal(update.args[0],'rejected');assert.equal(update.args[1],note);
 const audit=f.writes.find(x=>x.sql.startsWith('INSERT INTO admin_activity'));
 assert.equal(JSON.parse(audit.args[4]).reason,note);
});
test('YükUsta rejection suggestion stays a draft and does not change listing status',async()=>{
 const f=fixture({action:'rejection_suggestion',listing_id:'listing_123456',draft:'Fotoğraf yetersiz. 05451234567'},{ai:true});
 const r=await aiPost(f.context);assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.draft_only,true);assert.match(data.suggestion,/Fotoğraf/);
 assert.equal(f.writes.some(x=>x.sql.startsWith('UPDATE listings')),false);
 assert.doesNotMatch(JSON.stringify(f.calls),/05451234567/);
});
test('unauthenticated rejection suggestions never call the AI model',async()=>{
 const f=fixture({action:'rejection_suggestion',listing_id:'listing_123456'},{ai:true,cookie:false});
 assert.equal((await aiPost(f.context)).status,401);assert.equal(f.calls.length,0);
});
