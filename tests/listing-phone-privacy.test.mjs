import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as listingApiGet} from '../functions/api/listings/[id].js';
import {onRequestGet as listingPageGet} from '../functions/ilan/[id].js';

const listingId='listing_123456';
const phone='0532 123 45 67';

function context({url,listing={contact_phone:phone,status:'approved',category:'crane',trial_expires_at:Date.now()/1000+86400,paid_until:null},all=[]}={}){
 const queries=[];
 const DB={prepare(sql){queries.push(sql);return{bind(){return{first:async()=>{
  if(sql.includes('SELECT l.contact_phone')){
   const active=listing&&listing.status==='approved'&&(listing.category==='operator'||listing.owner_is_admin||Number(listing.trial_expires_at||0)>Date.now()/1000||Number(listing.paid_until||0)>Date.now()/1000);
   return active?listing:null;
  }
  return listing;
 },all:async()=>({results:all})}}}}};
 return {params:{id:listingId,slug:'vinc-kiralama'},request:new Request(url||`https://yukvinc.com.tr/api/listings/${listingId}`),env:{DB},queries};
}

test('call action keeps the number out of the page URL and redirects only after click',async()=>{
 const ctx=context({url:`https://yukvinc.com.tr/api/listings/${listingId}?contact=call`});
 const response=await listingApiGet(ctx);
 assert.equal(response.status,302);
 assert.equal(response.headers.get('location'),'tel:05321234567');
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.match(ctx.queries[0],/l\.status='approved'/);
 assert.match(ctx.queries[0],/trial_expires_at>unixepoch\(\)/);
 assert.equal(await response.text(),'');
});

test('WhatsApp stays available through a number-free page URL',async()=>{
 const response=await listingApiGet(context({url:`https://yukvinc.com.tr/api/listings/${listingId}?contact=whatsapp`}));
 assert.equal(response.status,302);
 assert.equal(response.headers.get('location'),'https://wa.me/905321234567');
 assert.equal(response.headers.get('cache-control'),'no-store');
});

test('contact action refuses inactive listings and invalid phone values',async()=>{
 const inactive=await listingApiGet(context({url:`https://yukvinc.com.tr/api/listings/${listingId}?contact=call`,listing:{contact_phone:phone,status:'pending',category:'crane'}}));
 assert.equal(inactive.status,404);
 const expired=await listingApiGet(context({url:`https://yukvinc.com.tr/api/listings/${listingId}?contact=call`,listing:{contact_phone:phone,status:'approved',category:'crane',trial_expires_at:1,paid_until:0}}));
 assert.equal(expired.status,404);
 const invalid=await listingApiGet(context({url:`https://yukvinc.com.tr/api/listings/${listingId}?contact=call`,listing:{contact_phone:'not a phone',status:'approved'}}));
 assert.equal(invalid.status,404);
});

test('listing detail HTML shows only Ara and retains WhatsApp without printing the number',async()=>{
 const row={id:listingId,listing_type:'equipment',category:'crane',title:'Vinç kiralama',description:'Bakımlı vinç hizmeti için ilan.',city:'İstanbul',district:'Kadıköy',price_amount:1000,price_unit:'günlük',contact_phone:phone,created_at:1,updated_at:1};
 const html=await (await listingPageGet(context({url:`https://yukvinc.com.tr/ilan/${listingId}/vinc-kiralama/`,listing:row}))).text();
 assert.match(html,/href="\/api\/listings\/listing_123456\?contact=call"[^>]*>Ara<\/a>/);
 assert.match(html,/href="\/api\/listings\/listing_123456\?contact=whatsapp"[^>]*>WhatsApp ile iletişime geç<\/a>/);
 assert.doesNotMatch(html,/0532\s*123\s*45\s*67/);
 assert.doesNotMatch(html,/tel:/);
 assert.doesNotMatch(html,/wa\.me/);
});
