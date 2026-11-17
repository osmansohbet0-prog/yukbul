import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const code=readFileSync(new URL('../edge/v222-listing-autoapproval.mjs',import.meta.url),'utf8');
const ai=new Function('return '+code)();
test('listings: client and Worker source are syntactically valid',()=>{
  const client=readFileSync(new URL('../edge/v222-extras.client.js',import.meta.url),'utf8');
  assert.doesNotThrow(()=>new Script(client));
  assert.ok(code.includes('status=\\'approved\\''));
});
test('Turkish phone format and gibberish checks block bad ads',()=>{
  assert.equal(ai.phone('0537 123 45 67'),true);
  assert.equal(ai.phone('+90 537 123 45 67'),true);
  assert.equal(ai.phone('6464984364'),false);
  assert.equal(ai.phone('123'),false);
  assert.equal(ai.random('asdf asdf asdf qwerty'),true);
  assert.equal(ai.random('35 tonluk vinç ile Konya merkezde güvenli yük kaldırma ve montaj hizmeti sağlıyoruz.'),false);
});
test('AI verdict requires explicit boolean checks and numeric confidence',()=>{
  const good={photo_matches_category:true,random_or_spam:false,brand_mismatch:false,confidence:0.95};
  assert.equal(ai.parseDecision({response:JSON.stringify(good)}).confidence,0.95);
  assert.throws(()=>ai.parseDecision({response:'{"photo_matches_category":"yes","random_or_spam":false,"brand_mismatch":false,"confidence":1}'}));
  assert.throws(()=>ai.parseDecision({response:'{"photo_matches_category":true,"random_or_spam":false,"brand_mismatch":false,"confidence":"yes"}'}));
});
test('no-photo POST is rejected before the original Worker runs',async()=>{
  let forwarded=false;
  const env={ORIGIN:{async fetch(){forwarded=true;return Response.json({ok:true})}}};
  const request=new Request('https://yukvinc.com.tr/api/listings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listing:{category:'crane',title:'Vinç kiralama',description:'Konya merkezde mobil vinç ile yük kaldırma ve montaj hizmetleri sunuyoruz.',contact_phone:'05371234567'},photos:[]})});
  const response=await ai.handle(request,env,{waitUntil(){}});
  assert.equal(response.status,400);
  assert.equal((await response.json()).code,'PHOTO_REQUIRED');
  assert.equal(forwarded,false);
});
test('photo-removal PATCH is blocked; photo retained PATCH can pass through',async()=>{
  let forwarded=0;
  const env={ORIGIN:{async fetch(){forwarded++;return Response.json({ok:true,status:'pending'})}}};
  const listing={category:'crane',title:'35 ton vinç kiralık',description:'Konya merkezde mobil vinç ile yük kaldırma ve montaj hizmetleri sunuyoruz.',contact_phone:'05371234567'};
  let req=new Request('https://yukvinc.com.tr/api/listings/abcdef123456',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({listing,photos:[]})});
  assert.equal((await ai.handle(req,env,{})).status,400);assert.equal(forwarded,0);
  req=new Request('https://yukvinc.com.tr/api/listings/abcdef123456',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({listing})});
  const r=await ai.handle(req,env,{});
  assert.equal(r.status,200);assert.equal(forwarded,1);
});
test('client controls only one active mobile navigation tab and locks background scrolling',()=>{
  const js=readFileSync(new URL('../edge/v222-extras.client.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../edge/v222-extras.css',import.meta.url),'utf8');
  assert.match(js,/function syncMobileNav/);assert.match(js,/removeAttribute\('aria-current'\)/);
  assert.match(js,/yv2-chat-open/);assert.match(js,/passive:false/);
  assert.match(css,/body\.yv2-chat-open/);assert.match(css,/overflow-y:auto!important/);
});
