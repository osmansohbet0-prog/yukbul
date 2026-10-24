import test from 'node:test';
import assert from 'node:assert/strict';
import {validateListing,validatePhotoPayloads,isNearDuplicate,redactForAI,photoHashDistance,detectDuplicateSignals,findDuplicateSignals,aiReview,publicItems} from '../functions/_lib/listings.js';
import {onRequestPost as onAdminListingPost} from '../functions/api/admin-listings.js';
import {onRequestPost} from '../functions/api/listings/index.js';
import {onRequestPatch,onRequestDelete} from '../functions/api/listings/[id].js';
import {listingFailure} from '../functions/_lib/listing-errors.js';

const listing=overrides=>({
  category:'crane',listing_type:'equipment',title:'50 ton mobil vinç kiralama',
  description:'Konya merkez ve ilçelerinde mobil vinç kiralama hizmeti verilir.',
  city:'Konya',district:'Meram',address:'',price_amount:5000,price_unit:'günlük',
  contact_phone:'05451234567',...overrides
});
class FakeD1{
  prepare(sql){
    const stmt={sql,args:[],bind(...args){this.args=args;return this},async first(){
      if(this.sql.includes('FROM user_sessions'))return{id:'member-1',email:'test@example.test',role:'member'};
      if(this.sql.includes('COUNT(*) n')&&this.sql.includes('user_login_attempts'))return{n:0};
      if(this.sql.includes('SELECT id,status FROM listings'))return{id:this.args[0],status:'pending'};
      if(this.sql.includes('SELECT id FROM listings WHERE content_hash'))return null;
      return null;
    },async all(){return{results:[]}},async run(){
      return{meta:{changes:1}};
    }};
    return stmt;
  }
  async batch(statements){for(const statement of statements)await statement.run();return statements.map(()=>({meta:{changes:1}}))}
}
function context(body,method='POST',id,authenticated=true){
  const request=new Request('https://yukvinc.com.tr/api/listings'+(id?'/'+id:''),{
    method,headers:{origin:'https://yukvinc.com.tr','content-type':'application/json',...(authenticated?{cookie:'__Host-yv_member=test-session'}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const waiting=[];
  return{request,env:{DB:new FakeD1(),AI_ENABLED:'false'},params:id?{id}:{},ctx:{waitUntil(p){waiting.push(p)}},waiting};
}
function payload(input=listing(),photos=[]){return{listing:input,photos,privacy_ok:true,hp:''}}
async function json(response){return response.json()}

test('listing validation accepts a complete equipment ad and rejects an unselected city',()=>{
  assert.equal(validateListing(listing()),null);
  assert.match(validateListing(listing({city:'Kony'})),/81 ilden/);
});
test('operator job follows the UI: phone is optional but validated when supplied',()=>{
  assert.equal(validateListing(listing({category:'operator',listing_type:'operator_job',price_amount:null,contact_phone:''})),null);
  assert.match(validateListing(listing({category:'operator',listing_type:'operator_job',price_amount:null,contact_phone:'abc'})),/telefon/);
});
test('public listing query keeps admin listings visible without an expiry',async()=>{let sql='';const db={prepare(query){sql=query;return{bind(){return this},async all(){return{results:[]}}}}};await publicItems(db);assert.match(sql,/u\.role='admin'/);assert.match(sql,/l\.trial_expires_at>unixepoch\(\)/)});
test('AI moderation sends stored listing photos to the YükVinç vision model',async()=>{const calls=[];const db={prepare(query){return{bind(){return this},async run(){return{meta:{changes:1}}},async all(){return{results:query.includes('SELECT mime_type,image_blob')?[{mime_type:'image/webp',image_blob:new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80])}]:[]}}}}};const env={AI_ENABLED:'true',AI:{async run(model,input){calls.push({model,input});return model.includes('moondream')?{answer:'Vinç fotoğrafı.'}:{response:'{"duplicate":false,"suspicious":false,"reason":""}'}}}};const result=await aiReview(env,db,'member-1',listing(),'listing_123456');assert.equal(result.reviewed,true);assert.equal(result.images_reviewed,1);assert.equal(calls[0].model,'@cf/moondream/moondream3.1-9B-A2B');assert.match(calls[0].input.image,/^data:image\/webp;base64,/);assert.deepEqual(JSON.parse(calls[1].input.messages[1].content).image_observations,['Vinç fotoğrafı.'])});
test('admin-created listings are written without any expiry column',async()=>{const sql=[];const db={prepare(query){sql.push(query);return{args:[],bind(...args){this.args=args;return this},async first(){return query.includes('admin_sessions')?{id:'admin-1',email:'admin@example.test',role:'admin'}:null},async run(){return{meta:{changes:1}}}}}};const fields=listing();const request=new Request('https://yukvinc.com.tr/api/admin-listings',{method:'POST',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json',cookie:'__Host-yv_admin=admin-session'},body:JSON.stringify({fields,photos:[]})});const response=await onAdminListingPost({request,env:{DB:db}});assert.equal(response.status,201);const insert=sql.find(query=>query.startsWith('INSERT INTO listings'));assert.ok(insert);assert.doesNotMatch(insert,/trial_expires_at/)});

test('duplicate heuristic and AI redaction work without passing contact details through',()=>{
  assert.equal(isNearDuplicate(listing(),listing({title:'50 ton mobil vinç kiralama'})),true);
  assert.equal(redactForAI('Ara 0545 123 45 67 veya test@example.com https://example.test'),'Ara [telefon gizlendi] veya [e-posta gizlendi] [bağlantı gizlendi]');
});

test('same company name and photo hash place a matching listing in admin review',()=>{const item=listing({business_name:'Vinç AŞ',visual_hashes:['0000000000000000']});const old={id:'older-12345678',category:'crane',city:'Konya',district:'Meram',business_name:' vinç aş ',title:'Başka başlık',description:'Farklı bir açıklama',visual_hash:'ffffffffffffffff'};assert.equal(photoHashDistance('0000000000000000','0000000000000001'),1);const signal=detectDuplicateSignals(item,[old]);assert.equal(signal.id,old.id);assert.match(signal.reason,/aynı firma adı/);assert.equal(detectDuplicateSignals(listing({business_name:'Farklı Firma'}),[old]),null)});
test('near-identical photo fingerprint flags a repeated listing even without a company name',()=>{const item=listing({business_name:'',visual_hashes:['0000000000000000']});const old={id:'older-12345678',category:'crane',city:'Konya',district:'Meram',business_name:null,title:'Başka ilan',visual_hash:'0000000000000003'};assert.equal(photoHashDistance(item.visual_hashes[0],old.visual_hash),2);assert.match(detectDuplicateSignals(item,[old]).reason,/fotoğraf/)});

test('background duplicate scan loads the submitted photo fingerprint from storage',async()=>{const sql=[];const db={prepare(query){sql.push(query);return{bind(){return this},async all(){if(query.includes('SELECT l.id,l.category'))return{results:[{id:'old-12345678',category:'crane',city:'Konya',district:'Meram',business_name:null,title:'Benzer fotoğraflı ilan',visual_hash:'0000000000000003'}]};if(query.includes('SELECT visual_hash FROM listing_photos'))return{results:[{visual_hash:'0000000000000000'}]};return{results:[]}}}}};const signal=await findDuplicateSignals(db,'new-12345678',listing({business_name:''}));assert.equal(signal.id,'old-12345678');assert.match(signal.reason,/fotoğraf/);assert.equal(sql.length,2)});
test('photo validation rejects oversized data and unsupported MIME types',()=>{
  const bytes=new Uint8Array(1_800_001);
  const b64=Buffer.from(bytes).toString('base64');
  assert.throws(()=>validatePhotoPayloads([{mime_type:'image/webp',data:b64}]),/1,8 MB/);
  assert.throws(()=>validatePhotoPayloads([{mime_type:'image/gif',data:'R0lGODlh'}]),/JPEG, PNG veya WebP/);
});
test('authenticated API can create, edit and delete an ad with the D1 binding contract',async()=>{
  const create=context(payload());
  const created=await onRequestPost(create);
  assert.equal(created.status,201);
  await Promise.all(create.waiting);
  const edit=context(payload(listing({title:'Mobil vinç Meram ve Konya genelinde'})),'PATCH','listing_123456');
  const edited=await onRequestPatch(edit);
  assert.equal(edited.status,200);
  await Promise.all(edit.waiting);
  const remove=context(undefined,'DELETE','listing_123456');
  const deleted=await onRequestDelete(remove);
  assert.equal(deleted.status,200);
});
test('bad city returns a safe field-aware API error before an insert',async()=>{
  const response=await onRequestPost(context(payload(listing({city:'Kony'}))));
  assert.equal(response.status,400);
  const result=await json(response);
  assert.equal(result.code,'CITY_INVALID');
  assert.equal(result.field,'city');
  assert.equal('stack'in result,false);
});

test('up to three compressed photos are accepted and a fourth is rejected',()=>{
  const bytes=Buffer.from([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50]);
  const photo={mime_type:'image/webp',data:bytes.toString('base64')};
  assert.equal(validatePhotoPayloads([photo,photo,photo]),true);
  assert.throws(()=>validatePhotoPayloads([photo,photo,photo,photo]),/en fazla 3/);
});
test('unauthenticated create, edit and delete are denied',async()=>{
  const created=await onRequestPost(context(payload(), 'POST', undefined, false));
  assert.equal(created.status,401);
  assert.equal((await json(created)).code,'AUTH_REQUIRED');
  const edited=await onRequestPatch(context(payload(), 'PATCH', 'listing_123456', false));
  assert.equal(edited.status,401);
  const removed=await onRequestDelete(context(undefined, 'DELETE', 'listing_123456', false));
  assert.equal(removed.status,401);
});

test('database and oversized request failures get safe diagnostic codes',async()=>{
  const request=new Request('https://yukvinc.com.tr/api/listings',{method:'POST'});
  const large=await listingFailure(new Error('İstek çok büyük.'),request,'test',413).json();
  assert.equal(large.code,'REQUEST_TOO_LARGE');
  const schema=await listingFailure(new Error('no such table: listings'),request,'test',500).json();
  assert.equal(schema.code,'TABLE_MISSING');
  assert.equal('stack' in schema,false);
});

test('AI review failure never blocks publishing a newly submitted listing to moderation',async()=>{
  const ctx=context(payload());
  ctx.env.AI_ENABLED='true';ctx.env.AI={async run(){throw new Error('AI temporarily unavailable')}};
  const response=await onRequestPost(ctx);
  assert.equal(response.status,201);
  await Promise.all(ctx.waiting);
});
