import test from 'node:test';
import assert from 'node:assert/strict';
import {validateToolCall,haversine,rankNearby} from '../functions/_lib/agent-tools.js';
import {runBudgetedAI} from '../functions/_lib/ai-budget.js';
import {validateAssistantOutput} from '../functions/_lib/ai-policy.js';
import {onRequestPost} from '../functions/api/ai/assistant.js';
test('tools exclude every mutation and arbitrary fields',()=>{
 for(const name of ['approve','reject','delete','sql','fetch','block_user','assign_package'])assert.equal(validateToolCall(name,{}),false);
 assert.equal(validateToolCall('listing_search',{city:'Konya',query:'vinç'}),true);
 assert.equal(validateToolCall('listing_search',{city:'Konya',sql:'DROP TABLE listings'}),false);
 assert.equal(validateToolCall('nearby_search',{latitude:37.8,longitude:32.5}),true);
 assert.equal(validateToolCall('nearby_search',{latitude:91,longitude:32}),false);
});
test('nearby ordering uses real coordinates and omits coordinates from results',()=>{
 const p={latitude:37.87,longitude:32.49};assert.equal(haversine(p,p),0);
 const result=rankNearby([{id:'close',...p},{id:'far',latitude:38.87,longitude:32.49},{id:'unknown'}],p,200);
 assert.deepEqual(result.map(x=>x.id),['close','far']);assert.ok(result[1].distance_km>100);assert.equal('latitude' in result[0],false);assert.equal('longitude' in result[0],false);
});
test('no model call occurs when the atomic daily budget cannot reserve',async()=>{
 let called=false;const env={DB:{prepare(){return{bind(){return this},async run(){return{meta:{changes:0}}}}}},AI:{async run(){called=true}}};
 await assert.rejects(runBudgetedAI(env,'model',{}),/AIDailyBudget/);assert.equal(called,false);
});
test('model output cannot quote prices or promise packages',()=>{for(const response of ['Size 100 TL fiyat veriyorum.','Ücretsiz paket tanımlayacağım.','İlanı onayladım.','İndirim yaptım.'])assert.equal(validateAssistantOutput({response}).ok,false)});
test('emergency intent returns 112 before any model or admin mutation',async()=>{
 let called=false;const writes=[];const db={prepare(sql){return{bind(){return this},async first(){return sql.includes('site_settings')?{value_json:'{"enabled":true}'}:{n:0}},async run(){writes.push(sql);return{meta:{changes:1}}}}}};
 const request=new Request('https://yukvinc.com.tr/api/ai/assistant',{method:'POST',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json'},body:JSON.stringify({message:'Kaza oldu yaralanma var'})});
 const response=await onRequestPost({request,env:{DB:db,AI_ENABLED:'true',AI:{async run(){called=true}}}});const data=await response.json();assert.equal(data.mode,'emergency');assert.match(data.answer,/112/);assert.equal(called,false);assert.ok(writes.every(sql=>!sql.includes('UPDATE listings')));
});
