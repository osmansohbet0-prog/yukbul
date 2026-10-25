import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyTurnstile} from '../functions/_lib/member.js';
const env={TURNSTILE_SECRET:'test-only',TURNSTILE_SITE_KEY:'test-only'},request=new Request('https://yukvinc.com.tr/api/auth/login');
test('Turnstile fails closed on wrong host, action, response and missing hostname',async()=>{
 const original=globalThis.fetch;
 try{for(const result of [{success:true,hostname:'evil.test',action:'member_auth'},{success:true,hostname:'yukvinc.com.tr',action:'different'},{success:true,action:'member_auth'},{success:false,hostname:'yukvinc.com.tr',action:'member_auth'}]){globalThis.fetch=async()=>Response.json(result);assert.equal(await verifyTurnstile('test-token-12345',request,env),false)}
 globalThis.fetch=async()=>Response.json({success:true,hostname:'yukvinc.com.tr',action:'member_auth'});assert.equal(await verifyTurnstile('test-token-12345',request,env),true);
 globalThis.fetch=async()=>new Response('',{status:502});assert.equal(await verifyTurnstile('test-token-12345',request,env),false);
 assert.equal(await verifyTurnstile('x'.repeat(2049),request,env),false);
 }finally{globalThis.fetch=original}
});
