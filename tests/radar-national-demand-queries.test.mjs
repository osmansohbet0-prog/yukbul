import test from 'node:test';
import assert from 'node:assert/strict';
import {nationalDemandQueries} from '../functions/_lib/radar-national-catalog.js';
import {triageKocaeliSearchHit} from '../functions/_lib/radar-kocaeli-search-triage.js';

test('location words are independent phrases rather than one fragile exact phrase',()=>{
 const plan=nationalDemandQueries(41,'Gebze','Güzeller Mahallesi');
 assert.deepEqual(plan.locationTerms,['Kocaeli','Gebze','Güzeller Mahallesi']);
 for(const q of plan.queries){
  assert.ok(q.query.startsWith('"Kocaeli" "Gebze" "Güzeller Mahallesi" '));
  assert.ok(!q.query.includes('"Kocaeli Gebze Güzeller Mahallesi"'));
  assert.equal(new URL(q.url).searchParams.get('q'),q.query);
 }
});

test('a province-wide search and a validated district work without neighborhood input',()=>{
 assert.ok(nationalDemandQueries(34).queries.every(q=>q.query.startsWith('"İstanbul" ')));
 assert.deepEqual(nationalDemandQueries(34,'Kadıköy').locationTerms,['İstanbul','Kadıköy']);
 assert.equal(nationalDemandQueries(41,'Kadıköy'),null);
 assert.equal(nationalDemandQueries(82),null);
});

test('crane, manlift and telehandler plans include first-person buyers and longer rental needs',()=>{
 const plan=nationalDemandQueries(41,'Gebze');
 assert.equal(plan.queries.length,4);
 assert.match(plan.queries.find(q=>q.equipment==='crane').query,/vinç kiralamak istiyorum/);
 assert.match(plan.queries.find(q=>q.equipment==='manlift').query,/manlift kiralamak istiyoruz/);
 assert.match(plan.queries.find(q=>q.equipment==='telehandler').query,/manito kiralamak istiyorum/);
 assert.match(plan.queries.find(q=>q.equipment==='telehandler').query,/telehandler aranıyor/);
 assert.match(plan.queries.map(q=>q.query).join(' '),/aylık|uzun dönem/);
 assert.ok(plan.queries.every(q=>q.intent==='rental_buyer'&&q.query.includes('-"kiraya veriyoruz"')));
});

test('last-day Google filtering never replaces original source publication evidence',()=>{
 const plan=nationalDemandQueries(41,'Gebze');
 assert.equal(plan.automaticExecution,false);
 assert.equal(plan.sourcePublishedAtRequired,true);
 assert.equal(plan.freshness.indexFilterOnly,true);
 assert.equal(plan.freshness.provesSourcePublicationTime,false);
 for(const q of plan.queries){
  assert.equal(new URL(q.url).searchParams.get('tbs'),'qdr:d');
  assert.equal(q.sourcePublishedAtRequired,true);
  assert.equal(q.automaticPublication,false);
 }
});

test('neighborhood input cannot break the location phrase or inject search operators',()=>{
 for(const input of ['OSB" OR site:example.com','test\\','x\nOR y','<script>','x'.repeat(101)])assert.equal(nationalDemandQueries(41,'Gebze',input),null);
 const plan=nationalDemandQueries(41,'Gebze','  Güzeller   Mahallesi  ');
 assert.equal(plan.neighborhood,'Güzeller Mahallesi');
});

const buyerEvidence={city:'Kocaeli',district:'Gebze',url:'https://www.kocaeli.bel.tr/duyuru/ornek',sourceVerified:true,buyerVerified:true,openStatusConfirmed:true};
test('first-person manlift and telehandler rental buyers remain candidates',()=>{
 const now=Date.now(),evidence={...buyerEvidence,authorPublishedAt:new Date(now-3600000).toISOString()};
 for(const title of [
  'Gebze fabrikamız için manlift kiralamak istiyoruz',
  'Gebze şantiyemize manito kiralamak istiyorum',
  'Gebze projemiz için telehandler kiralayacağız',
  'Gebze projemiz için manitou kiralayacagiz',
  'Gebze fabrikamız için aylık manlift kiralama talebi',
  'Gebze fabrikamız için manito kiralanacak'
 ]){
  const r=triageKocaeliSearchHit({...evidence,title},{now});
  assert.equal(r.status,'fresh_confirmed_buyer',title+': '+r.reason);
  assert.equal(r.publiclyPublishable,false);
 }
});

test('provider ads, operator recruitment and equipment sales cannot pose as rental buyers',()=>{
 const now=Date.now(),evidence={...buyerEvidence,authorPublishedAt:new Date(now-3600000).toISOString()};
 const examples=[
  ['Manlift kiralama hizmetlerimiz, Gebze için teklif istiyoruz','provider_advertisement'],
  ['Manito kiralama firması, Gebze için hizmet sunuyoruz','provider_advertisement'],
  ['Gebze manlift operatörü aranıyor','personnel_recruitment'],
  ['Gebze manito operatörü arıyoruz','personnel_recruitment'],
  ['Gebze mobil vinç operatörü aranıyor','personnel_recruitment'],
  ['Gebze satılık manito, fiyat teklifi alınacaktır','sale_or_property'],
  ['Gebze manlift satın alma, fiyat teklifi alınacaktır','sale_or_property']
 ];
 for(const [title,reason] of examples){const r=triageKocaeliSearchHit({...evidence,title},{now});assert.equal(r.status,'discard',title);assert.equal(r.reason,reason,title);}
});

test('new rental phrases still need verified publication and buyer evidence',()=>{
 const r=triageKocaeliSearchHit({...buyerEvidence,title:'Gebze manlift kiralamak istiyoruz',sourceVerified:false,buyerVerified:false});
 assert.equal(r.status,'admin_review');assert.equal(r.recent24h,false);assert.equal(r.publiclyPublishable,false);
});
