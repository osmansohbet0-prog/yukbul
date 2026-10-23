import test from 'node:test';
import assert from 'node:assert/strict';
import {validateListing,validatePhotoPayloads,isNearDuplicate,redactForAI} from '../functions/_lib/listings.js';
import {onRequestPost} from '../functions/api/listings/index.js';
import {onRequestPatch,onRequestDelete} from '../functions/api/listings/[id].js';

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
test('duplicate heuristic and AI redaction work without passing contact details through',()=>{
  assert.equal(isNearDuplicate(listing(),listing({title:'50 ton mobil vinç kiralama'})),true);
  assert.equal(redactForAI('Ara 0545 123 45 67 veya test@example.com https://example.test'),'Ara [telefon gizlendi] veya [e-posta gizlendi] [bağlantı gizlendi]');
});
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
