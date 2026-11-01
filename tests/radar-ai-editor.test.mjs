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

test('Rejects a copied business phone in public AI description',()=>{
 const title='Gebze için 50 ton mobil vinç kiralama';
 const description='Örnek Kurum Gebze için 50 ton mobil vinç kiralayacaktır. Konu hakkında bilgi almak üzere 0262 325 23 05 numarası aranabilir. İşin süresi 3 aydır.';
 const trusted=evidence+' 0262 325 23 05';
 const r=validateModelDraft({title,description},trusted);
 assert.equal(r.ok,false);
 assert.equal(r.error,'AI_PHONE_SHOULD_BE_ADMIN_ONLY');
});

test('A source-checked fresh social buyer can receive AI DRAFT without EKAP deadline',async()=>{
 const socialLead={
   id:'social-gebze-2026-11-02',title:'Gebze için vinç lazım',
   description:'Fabrikamızda makine indirme için mobil vinç arıyoruz.',
   city:'Kocaeli',district:'Gebze',
   sourceUrl:'https://example.com/posts/public-buyer',
   authorPublishedAt:'2026-11-02T09:00:00+03:00',
   sourceChecked:true,buyerConfirmed:false,openStatusConfirmed:false,deadline:null
 };
 const trustedSource='Gebze tesisimizde yeni üretim hattına ağır makine indirmek için vinç kiralama teklifi istiyoruz. İlanı kurumumuz yayımladı; çalışma günü ve vinç tonajı henüz kesinleşmedi.';
 const binds=[];
 const env={DB:{prepare(){return{bind(...args){binds.push(args);return{async run(){return{meta:{changes:1}}}}}}}},
   AI:{async run(){return{response:JSON.stringify({
      title:'Gebze tesisinde makine indirme için vinç kiralama talebi',
      description:'Gebze bölgesindeki tesiste makine indirme ve montaj çalışması için vinç kiralama teklifi istenmektedir. Vinç tonajı, çalışma süresi ve teklif ayrıntıları kaynakta kesin olarak belirtilmediğinden işletmeyle teyit edilmelidir.',
      missingFacts:['Kesin tonaj ve tarih','Alıcı görüşmesiyle aktif talep doğrulanmalı']
   })}}}};
 const r=await draftRadarLeadWithAI(env,{adminVerified:true},socialLead,trustedSource,now);
 assert.equal(r.ok,true);assert.equal(r.published,false);assert.equal(r.needsAdminApproval,true);
 assert.ok(binds.some(args=>args.includes(socialLead.id)));
});
test('Unconfirmed old social buyer cannot consume AI budget',async()=>{
 const socialLead={
   id:'old-social',title:'Gebze için vinç lazım',
   description:'Fabrikamıza makine indirme için vinç arıyoruz.',city:'Kocaeli',district:'Gebze',
   sourceUrl:'https://example.com/old',authorPublishedAt:'2026-10-12T09:00:00+03:00',
   sourceChecked:true,buyerConfirmed:false,deadline:null
 };
 let called=false;
 const env={DB:{prepare(){called=true;throw Error('AI budget not expected')}},AI:{async run(){called=true}}};
 const r=await draftRadarLeadWithAI(env,{adminVerified:true},socialLead,evidence,now);
 assert.equal(r.ok,false);assert.equal(called,false);
});
