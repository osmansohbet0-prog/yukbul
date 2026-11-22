import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
import {judge,validPhone,parseResult,runAutoReview} from '../edge/v222-auto-review.mjs';
import worker from '../edge/v222-extras.worker.mjs';

const item={
 id:'sampleid01234567',status:'pending',title:'25 ton mobil vinç kiralama',
 description:'Konya merkez ve ilçelerinde operatörlü mobil vinç kiralama hizmeti verilir.',
 category:'crane',listing_type:'equipment',contact_phone:'0555 123 45 67',
 photo_count:2,risk_score:5,updated_at:1000
};
const vision=['A truck crane with an extended boom on a construction site.','A close image of industrial crane lifting equipment.'];
const good={photo_match:'match',text_quality:'good',brand_consistency:'uncertain',safe_to_publish:true,company_unverified:true,confidence:.9};
test('Turkish phone numbers validate and obvious nonsense is rejected',()=>{
 assert.equal(validPhone('0555 123 45 67'),true);
 assert.equal(validPhone('+90 555 123 45 67'),true);
 assert.equal(validPhone('5551234567'),true);
 assert.equal(validPhone('0555123'),false);
 assert.equal(validPhone('00000000000'),false);
 assert.equal(validPhone('',true),true);
 assert.equal(validPhone('',false),false);
});
test('only high confidence complete photo and text review can auto publish',()=>{
 assert.equal(judge(item,vision,good).action,'approved');
 assert.equal(judge({...item,photo_count:0},vision,good).action,'manual');
 assert.equal(judge({...item,risk_score:80},vision,good).action,'manual');
 assert.equal(judge({...item,status:'flagged'},vision,good).action,'manual');
 assert.equal(judge(item,vision,{...good,photo_match:'uncertain'}).action,'manual');
 assert.equal(judge(item,vision,{...good,confidence:.5}).action,'manual');
 assert.equal(judge(item,vision.slice(0,1),good).action,'manual');
});
test('clear photo mismatch rejects; uncertain image never auto rejects',()=>{
 assert.equal(judge(item,vision,{...good,photo_match:'mismatch',confidence:.99}).action,'rejected');
 assert.equal(judge(item,vision,{...good,photo_match:'mismatch',confidence:.7}).action,'manual');
 assert.equal(judge(item,vision,{...good,text_quality:'random',confidence:.99}).action,'rejected');
 assert.equal(judge(item,vision,{...good,brand_consistency:'contradiction'}).action,'manual');
});
test('strict JSON parser rejects missing decisions',()=>{
 assert.deepEqual(parseResult({response:JSON.stringify(good)}),good);
 assert.throws(()=>parseResult({response:'not json'}));
 assert.throws(()=>parseResult({response:'{"photo_match":"match"}'}));
});
test('missing photos and clearing the last photo are rejected by V222 edge gate',async()=>{
 const env={ORIGIN:{fetch(){throw Error('Must not forward incomplete photo requests')}}};
 const make=(method,path,photos)=>new Request('https://yukvinc.com.tr'+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify({listing:{category:'crane',contact_phone:'05551234567'},photos})});
 let response=await worker.fetch(make('POST','/api/listings',[]),env);
 assert.equal(response.status,400);assert.equal((await response.json()).field,'photos');
 response=await worker.fetch(make('PATCH','/api/listings/sampleid01234567',[]),env);
 assert.equal(response.status,400);assert.equal((await response.json()).field,'photos');
});
test('the active mobile navigation, background scroll lock and four-step wizard code parse',()=>{
 const nav=readFileSync(new URL('../edge/v222-extras.client.js',import.meta.url),'utf8');
 const form=readFileSync(new URL('../edge/v222-premium-listing-form.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../edge/v222-extras.css',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Script(nav));
 assert.doesNotThrow(()=>new Script(form));
 assert.match(nav,/fixActiveMobileNav/);assert.match(nav,/lockBackdrop/);
 assert.match(form,/STEP_GROUPS=\[\[0,1\],\[2,3\],\[4\],\[5\]\]/);
 assert.match(form,/hasRequiredPhoto/);
 assert.match(css,/yv2-chat-scroll-lock/);
 assert.match(css,/yv-mobile-nav.*yv2-nav-active/s);
});
test('auto review cron does nothing without AI binding and never inserts demo data',async()=>{
 const result=await runAutoReview({DB:{}},{dryRun:true});
 assert.equal(result.skipped,'bindings');
});
