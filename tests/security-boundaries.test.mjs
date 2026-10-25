import test from 'node:test';
import assert from 'node:assert/strict';
import {readJson,cookieValue} from '../functions/_lib/core.js';
import {cookieToken} from '../functions/_lib/member.js';
import {readMemberJson} from '../functions/_lib/member.js';
import {onRequestGet as health} from '../functions/api/saglik.js';
import {onRequestPost as logout} from '../functions/api/auth/logout.js';
import {onRequestPatch} from '../functions/api/listings/[id].js';
test('JSON reader bounds streaming bodies even without a content-length header',async()=>{
 const request=new Request('https://yukvinc.com.tr/api/listings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:'x'.repeat(2000)})});
 await assert.rejects(readJson(request,100),/İstek çok büyük/);
});
test('malformed session cookie cannot crash authentication',()=>{
 const request=new Request('https://yukvinc.com.tr/',{headers:{cookie:'__Host-yv_admin=%XX; __Host-yv_member=%XX'}});
 assert.equal(cookieValue(request),'');assert.equal(cookieToken(request),'');
});
test('URL-encoded forms have the same streaming body limit as JSON',async()=>{
 const request=new Request('https://yukvinc.com.tr/api/auth/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'email='+('x'.repeat(500))});await assert.rejects(readMemberJson(request,100),/İstek çok büyük/);
});
test('public health does not expose schema, migrations or secret configuration',async()=>{
 const db={prepare(){return{async first(){return{ok:1}}}}};const request=new Request('https://yukvinc.com.tr/api/saglik');assert.deepEqual(await (await health({request,env:{DB:db,ADMIN_SECURITY_CODE:'test'}})).json(),{ok:true});const denied=await health({request:new Request('https://yukvinc.com.tr/api/saglik?details=1'),env:{DB:db}});assert.equal(denied.status,401);
});
test('member logout rejects cross-origin mutation',async()=>{const r=await logout({request:new Request('https://yukvinc.com.tr/api/auth/logout',{method:'POST',headers:{origin:'https://evil.test'}}),env:{}});assert.equal(r.status,403)});
test('an authenticated member cannot edit another account listing',async()=>{
 const writes=[];const db={prepare(sql){return{bind(...args){this.args=args;return this},async first(){if(sql.includes('user_sessions'))return{id:'attacker',role:'member'};if(sql.includes('WHERE id=? AND user_id=?')){assert.equal(this.args[1],'attacker');return null}return null},async run(){writes.push(sql);return{meta:{changes:1}}}}}};
 const request=new Request('https://yukvinc.com.tr/api/listings/other_12345678',{method:'PATCH',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json',cookie:'__Host-yv_member=authenticated-test'},body:JSON.stringify({listing:{title:'Changed'}})});
 const r=await onRequestPatch({request,env:{DB:db},params:{id:'other_12345678'}});assert.equal(r.status,404);assert.deepEqual(writes,[]);
});
