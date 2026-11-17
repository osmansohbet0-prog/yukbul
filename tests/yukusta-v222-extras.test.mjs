import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../edge/v222-extras.worker.mjs';

const api='https://yukvinc.com.tr/api/yukusta-v2/';
function mockDb() {
 const records=[];
 const db={
  records,
  prepare(sql){return{args:[],bind(...args){this.args=args;return this},
   async first(){
    if(sql.includes('lead_radar_leads'))return{n:1};
    if(sql.includes('site_settings'))return{value_json:'{"enabled":true}'};
    return{n:0}
   },
   async run(){records.push({sql,args:this.args});return{meta:{changes:1}}}
  }}
 };
 return db;
}
function ctx() {
 const db=mockDb();
 const env={DB:db,AI:{async run(model,input){return{response:'Selam! Vinç aramak için şehir yazabilirsin.'}}},ORIGIN:{async fetch(req){return Response.json({answer:'Konya için mevcut vinç ilanları listelendi.',listings:[{id:'test-listing01',title:'25 ton vinç',city:'Konya'}],mode:'search'})}}};
 return{db,env};
}
function request(path,body,method='POST',origin='https://yukvinc.com.tr'){
 return new Request(api+path,{method,headers:{origin,'content-type':'application/json','cf-connecting-ip':'203.0.113.12'},...(body?{body:JSON.stringify(body)}:{})});
}
test('versioned add-on health does not require auth',async()=>{
 const {env}=ctx();const res=await worker.fetch(request('health',undefined,'GET'),env);assert.equal(res.status,200);
 const d=await res.json();assert.equal(d.ok,true);assert.match(d.version,/v222-extras/);
});
test('tender badge uses approved, published and non-expired records only',async()=>{
 const {env}=ctx();const r=await worker.fetch(request('tenders',undefined,'GET'),env);
 assert.equal(r.status,200);assert.equal((await r.json()).new_count,1);
});
test('complaints become support tickets and do not give admin powers to AI',async()=>{
 const {env,db}=ctx();const r=await worker.fetch(request('report',{message:'Vinç ilanında sahte fotoğraf bulundu. Kontrol edin.'}),env);
 assert.equal(r.status,201);const data=await r.json();assert.match(data.reference,/^[a-f0-9]{32}$/);
 const insert=db.records.find(x=>x.sql.includes('INSERT INTO support_tickets'));
 assert.ok(insert,'Complaint should be saved in DB');assert.equal(insert.args[1],'assistant');
 assert.equal((await worker.fetch(request('report',{message:'kısa'}),env)).status,400);
 assert.equal((await worker.fetch(request('report',{message:'İlan sahibi yanlış bilgi paylaşmış.',},'POST','https://evil.example'),env)).status,403);
});
test('generic friend-like chat calls the newer language model with restricted context',async()=>{
 const {env}=ctx();let called=false;
 env.AI.run=async (model,input)=>{called=true;assert.match(model,/llama-3\.3-70b/);assert.match(input.messages[0].content,/Kimlik, telefon, parola isteme/);return{response:'Merhaba, nasılsın? Birlikte bakalım!'}};
 const r=await worker.fetch(request('chat',{message:'Nasılsın bugün?'}),env);
 assert.equal(r.status,200);assert.equal((await r.json()).mode,'chat');assert.equal(called,true);
});
test('concrete crane searches use the preserved V222 grounded assistant and result cards',async()=>{
 const {env}=ctx();let old=false;env.ORIGIN.fetch=async req=>{old=true;assert.match(req.url,/\/api\/ai\/assistant$/);return Response.json({answer:'Konya için vinç ilanları burada.',listings:[{id:'listing123456',title:'25 ton kiralık vinç'}]})};
 const r=await worker.fetch(request('chat',{message:'Konya kiralık vinç arıyorum.'}),env);const d=await r.json();
 assert.equal(r.status,200);assert.equal(old,true);assert.equal(d.mode,'search');assert.equal(d.listings.length,1);
});
test('standalone scoped assets are served with correct MIME types',async()=>{
 const {env}=ctx();let r=await worker.fetch(new Request('https://yukvinc.com.tr/assets/yv-v222-extras.js'),env);
 assert.equal(r.headers.get('content-type').split(';')[0],'application/javascript');
 r=await worker.fetch(new Request('https://yukvinc.com.tr/assets/yv-v222-extras.css'),env);
 assert.equal(r.headers.get('content-type').split(';')[0],'text/css');
});
test('chat interface includes scroller, complaint sender, APK and fresh tender endpoint',()=>{
 const js=readFileSync(new URL('../edge/v222-extras.client.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../edge/v222-extras.css',import.meta.url),'utf8');
 for(const token of ['yv2-messages','yv2-report','/report','/tenders','yukvinc-android-v0.5.0','yv-buyer-cta-v191'])assert.ok(js.includes(token),token);
 assert.match(css,/overflow-y:auto/);assert.match(css,/yv2-tender-badge/);
});
