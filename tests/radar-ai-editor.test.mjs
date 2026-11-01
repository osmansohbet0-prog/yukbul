import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRadarAiDraftInput,validateModelDraft,draftRadarLeadWithAI} from '../functions/_lib/radar-ai-editor.js';
const now=Date.parse('2026-11-02T10:00:00+03:00');
const lead={id:'verified-lead-1',organization:'Örnek Kurum',title:'Gebze 50 ton mobil vinç kiralama hizmet alımı',
 description:'3 aylık kiralama işi',city:'Kocaeli',district:'Gebze',
 workLocation:'Gebze',deadline:'2026-11-18T10:30',
 sourceUrl:'https://ornek.gov.tr/ihale/123',
 sourceChecked:true,buyerConfirmed:true};
const evidence='Örnek Kurum tarafından Gebze ilçesinde 50 ton mobil vinç kiralama hizmeti için 3 aylık hizmet alınacaktır. Son teklif tarihi 18 Kasım 2026 saat 10.30 ve ilgili başvuru işlemleri EKAP üzerinden yürütülecektir.';
test('AI prompt treats external content as data and never invents a phone',()=>{
 const p=buildRadarAiDraftInput(lead,evidence);
 assert.equal(p.response_format.type,'json_object');
 assert.match(p.messages[0].content,/ASLA UYDURMA/);
 assert.match(p.messages[0].content,/Telefon ve e-posta açıklamaya ekleme/);
 assert.ok(p.messages[1].content.includes('verifiedSourceText'));
});
test('Reject invented tonnage or date values in an AI summary',()=>{
 const text='Gebze 100 tonluk vinç kiralama işi için 3 ay süreli kiralama. Projede ilgili kurum vinç kullanacaktır.';
 const r=validateModelDraft({title:'Gebze 100 ton vinç kiralama',description:text},evidence);
 assert.equal(r.ok,false);assert.match(r.error,/AI_UNSUPPORTED_NUMBER/);
});
test('Reject non JSON responses and short content',()=>{
 assert.equal(validateModelDraft({response:'not json'},evidence).ok,false);
 assert.equal(validateModelDraft({title:'Kısa',description:'A'},evidence).ok,false);
});
test('Reject invalid actor before any D1 or AI access',async()=>{
 const env={DB:{},AI:{}};
 await assert.rejects(draftRadarLeadWithAI(env,{},lead,evidence,now),/NOT_AUTHORIZED/);
});
test('Reject a crane sale before Workers AI runs',async()=>{
 const env={DB:{prepare(){throw Error('No DB access expected')}},AI:{run(){throw Error('AI must not run')}}};
 const r=await draftRadarLeadWithAI(env,{adminVerified:true},
  {...lead,title:'Pelitli Depo Köprülü Gezer Vinç Mal Alımı'},evidence,now);
 assert.equal(r.ok,false);assert.equal(r.published,false);
});
test('Successful AI draft only queues for admin approval',async()=>{
 let calls=0,aiCalls=0;
 const env={DB:{prepare(sql){calls++;return {bind(){return{async run(){return {meta:{changes:1}}}}}}}},
   AI:{async run(){aiCalls++;return{response:JSON.stringify({
     title:'Gebze için 50 ton mobil vinç kiralama',
     description:'Örnek Kurum, Gebze bölgesinde 50 ton mobil vinç için 3 aylık hizmet alımı planlamaktadır. Teklif son tarihi 18 Kasım 2026 saat 10.30 olup başvuru işlemleri EKAP üzerinden gerçekleştirilecektir.',
     missingFacts:['İrtibat kişisinin kurumsal telefonu açıklamada yok']
   })}}}};
 const r=await draftRadarLeadWithAI(env,{adminVerified:true},lead,evidence,now);
 assert.equal(r.ok,true);assert.equal(r.needsAdminApproval,true);assert.equal(r.published,false);
 assert.equal(r.leadId,lead.id);assert.equal(aiCalls,1);assert.equal(calls,2);
});
test('AI quota guard stops generation without a model call',async()=>{
 let aiCalls=0;
 const env={DB:{prepare(){return {bind(){return{async run(){return {meta:{changes:0}}}}}}}},
 AI:{async run(){aiCalls++}}};
 await assert.rejects(draftRadarLeadWithAI(env,{adminVerified:true},lead,evidence,now),/BUDGET_EXHAUSTED/);
 assert.equal(aiCalls,0);
});
