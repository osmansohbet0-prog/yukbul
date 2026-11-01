import test from 'node:test';
import assert from 'node:assert/strict';
import {qualifyCraneRentalRequest,normalizeTR} from '../functions/_lib/radar-kocaeli-qualification.js';

const current=Date.parse('2026-11-02T10:00:00+03:00');
const base={title:'Gebze için operatörlü 50 ton mobil vinç kiralama hizmet alımı',
 description:'Proje boyunca vinç ihtiyaç duyuluyor',city:'Kocaeli',district:'Gebze',
 sourceUrl:'https://ornek-belediye.gov.tr/ihaleler/123',deadline:'2026-11-18T10:30',
 sourceChecked:true,buyerConfirmed:true};

test('Turkish input normalization retains word boundaries',()=>{
 assert.equal(normalizeTR('Çayırova – KÖRFEZ, Vinç'), 'cayirova korfez vinc');
});
test('Verified, future crane rental in Gebze is candidate (not auto-published)',()=>{
 const r=qualifyCraneRentalRequest(base,current);
 assert.equal(r.decision,'verified_candidate');assert.equal(r.regionPriority,1);
 assert.equal(r.activeVerified,true);assert.equal(r.forPublicPublishing,false);
 assert.equal(r.term,'monthly_or_project');
});
test('Gebze 2026/2071046 bridge crane and rack PURCHASE is not a lead',()=>{
 const r=qualifyCraneRentalRequest({
   title:'Pelitli Depo Ağır Rack Raf Sistemi ve Köprülü Gezer Vinç',
   description:'5 ton gezer köprülü vinç ve 83 raf satın alınacaktır',
   procurementType:'Mal Alımı',city:'Kocaeli',district:'Gebze',
   sourceUrl:'https://ekapv2.kik.gov.tr/ekap/search?searchText=2026%2F2071046',
   deadline:'2026-11-18T10:30',sourceChecked:true,buyerConfirmed:true
 },current);
 assert.equal(r.decision,'reject'); assert.equal(r.reason,'equipment_purchase');
});
test('Operator recruitment cannot be treated as a rental buyer',()=>{
 const r=qualifyCraneRentalRequest({...base,title:'Vinç operatörü aranıyor',
 description:'Sürekli iş için tecrübeli vinç operatörü işe alınacaktır'});
 assert.equal(r.reason,'personnel_recruitment');
});
test('Advertising a crane rental service is not a buyer request',()=>{
 const r=qualifyCraneRentalRequest({...base,title:'Gebze vinç kiralama hizmetlerimiz',
 description:'7 24 vinç kiralama hizmeti veriyoruz'});
 assert.equal(r.reason,'crane_provider_advertisement');
});
test('Past tender remains historical',()=>{
 const r=qualifyCraneRentalRequest({...base,deadline:'2026-10-27T15:00'},current);
 assert.equal(r.decision,'reject');assert.equal(r.reason,'deadline_passed');
});
test('Unknown deadline never becomes a verified open lead',()=>{
 const r=qualifyCraneRentalRequest({...base,deadline:null},current);
 assert.equal(r.decision,'needs_review');assert.equal(r.activeVerified,false);
});
test('Unverified contact or source cannot bypass approval',()=>{
 const r=qualifyCraneRentalRequest({...base,sourceChecked:false},current);
 assert.equal(r.decision,'needs_review');assert.equal(r.forPublicPublishing,false);
});
test('Rejects non-Kocaeli and source-URL spoofing',()=>{
 assert.equal(qualifyCraneRentalRequest({...base,city:'Antalya',district:'Alanya'},current).reason,'outside_target_region');
 assert.equal(qualifyCraneRentalRequest({...base,sourceUrl:'http://127.0.0.1/lead'},current).reason,'unverifiable_source_url');
});
test('Long rental and short market demand are separately ranked',()=>{
 const monthly=qualifyCraneRentalRequest({...base,title:'Gebze 3 aylık hiyap kiralama',
 description:'Sahada 3 ay çalışacak'},current);
 const daily=qualifyCraneRentalRequest({...base,title:'Gebze için vinç lazım',
 description:'Bir gün sürecek kaldırma işi'},current);
 assert.equal(monthly.term,'monthly_or_project');
 assert.equal(daily.term,'short_or_unspecified');
});
