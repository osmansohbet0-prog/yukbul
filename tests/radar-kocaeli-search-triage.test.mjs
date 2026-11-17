import test from 'node:test';
import assert from 'node:assert/strict';
import {triageKocaeliSearchHit,sortedReviewCandidates} from '../functions/_lib/radar-kocaeli-search-triage.js';
const now=Date.parse('2026-11-02T12:00:00+03:00');
const base={
 title:'Fabrikamıza Gebze için 50 tonluk vinç aranıyor',
 description:'3 ay boyunca montaj için operatörlü mobil vinç kiralama teklifi isteniyor.',
 city:'Kocaeli',district:'Gebze',
 url:'https://ornek-fabrika.com.tr/duyurular/2026-kiralama?utm_source=facebook',
 authorPublishedAt:'2026-11-02T09:00:00+03:00',
 sourceVerified:true,buyerVerified:true,openStatusConfirmed:true,
 publicBusinessContactVerified:true,organization:'Örnek Fabrika A.Ş.'
};
test('Published within 24h, real Kocaeli crane buyer prioritised for admin',()=>{
 const r=triageKocaeliSearchHit(base,{now});
 assert.equal(r.status,'fresh_confirmed_buyer');
 assert.equal(r.recent24h,true);
 assert.equal(r.term,'monthly_or_project');
 assert.equal(r.regionPriority,1);
 assert.equal(r.publiclyPublishable,false);
 assert.ok(!r.sourceUrl.includes('utm_'));
});
test('No verified publisher date => not fresh despite search indexing',()=>{
 const r=triageKocaeliSearchHit({...base,authorPublishedAt:'2 hours ago'}, {now});
 assert.equal(r.status,'admin_review');
 assert.equal(r.recent24h,false);
});
test('Provider ads from LinkedIn and Facebook are rejected',()=>{
 const r=triageKocaeliSearchHit({...base,
 title:'Gebze Vinç Kiralama - Geniş Filomuz ve 7/24 hizmetinizdeyiz',
 description:'Size vinç kiralama hizmeti sunuyoruz.',url:'https://linkedin.com/posts/vincfirmasi'}, {now});
 assert.equal(r.status,'discard');assert.equal(r.reason,'provider_advertisement');
});
test('Vinç operator recruitment is not a rental customer',()=>{
 const r=triageKocaeliSearchHit({...base,
 title:'Gebze vinç operatörü aranıyor',
 description:'Kule vinç operatörü iş ilanı, vardiyalı çalışma'}, {now});
 assert.equal(r.status,'discard');assert.equal(r.reason,'personnel_recruitment');
});
test('Bridge crane equipment/rack tender not classified as rental',()=>{
 const r=triageKocaeliSearchHit({...base,
 title:'Gebze Pelitli depo ağır rack raf sistemi ve köprülü gezer vinç mal alımı',
 description:'İhale konusu satın alma işi, 2026/2071046'}, {now});
 assert.equal(r.status,'discard');assert.equal(r.reason,'sale_or_property');
});
test('Industrial machine installation demand is a candidate for manual verification',()=>{
 const r=triageKocaeliSearchHit({...base,title:'Dilovası fabrikamıza makine indirme için teklif istiyoruz',
 description:'Fabrikamıza pres makinesi yerleştirme için kaldırma firması arıyoruz.',
 district:'Dilovası',url:'https://ornek.com/1',buyerVerified:false}, {now});
 assert.equal(r.status,'admin_review');assert.equal(r.category,'industrial_lifting');
});
test('Old tender cannot be new; past deadline discarded even if reposted recently',()=>{
 const r=triageKocaeliSearchHit({...base,deadline:'2026-10-21T10:00:00+03:00'}, {now});
 assert.equal(r.status,'discard');assert.equal(r.reason,'expired_tender_deadline');
});
test('Open status needs verified source and buyer',()=>{
 for (const data of [{sourceVerified:false},{buyerVerified:false},{openStatusConfirmed:false}]) {
  const r=triageKocaeliSearchHit({...base,...data}, {now});
  assert.equal(r.status,'admin_review');
 }
});
test('Historical public post cannot be categorized as fresh current offer',()=>{
 const r=triageKocaeliSearchHit({...base,authorPublishedAt:'2026-10-25T09:00:00+03:00'}, {now});
 assert.equal(r.status,'admin_review');assert.equal(r.recent24h,false);
});
test('Sort by confirmed status and then score, without publishing',()=>{
 const a={...base,title:'Günlük Gebze vinç lazım',description:'Vinç için teklif istiyoruz',durationMonths:0,organization:'A'};
 const b={...base,description:'3 aylık vinç işi uzun dönem',organization:'B'};
 const sorted=sortedReviewCandidates([a,{...b,sourceVerified:false},b],{now});
 assert.equal(sorted.length,3);assert.equal(sorted[0].triage.status,'fresh_confirmed_buyer');
 assert.ok(sorted.every(x=>!x.triage.publiclyPublishable));
});
