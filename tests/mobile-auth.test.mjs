import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as handoff} from '../functions/api/auth/mobile-handoff.js';
import {onRequestPost as exchange} from '../functions/api/auth/mobile-exchange.js';

const origin='https://yukvinc.com.tr';
const user={id:'member-1',email:'owner@example.com',role:'member'};

function fakeDb() {
  let pending;
  const calls=[];
  const DB={prepare(sql){
    const statement={sql,args:[],bind(...args){this.args=args;return this;},
      async first(){
        calls.push({sql,args:this.args,kind:'first'});
        if(sql.includes('SELECT COUNT(*) n FROM user_login_attempts'))return {n:0};
        if(sql.includes('FROM user_sessions s JOIN users'))return user;
        if(sql.startsWith('DELETE FROM mobile_auth_codes')){
          const [codeHash,challenge,now]=this.args;
          if(pending&&pending.codeHash===codeHash&&pending.challenge===challenge&&pending.expiresAt>now){
            pending=null;return {user_id:user.id};
          }
          return null;
        }
        if(sql.includes("FROM users WHERE id = ? AND role = 'member'")){
          return this.args[0]===user.id?user:null;
        }
        return null;
      },
      async run(){
        calls.push({sql,args:this.args,kind:'run'});
        if(sql.startsWith('INSERT INTO mobile_auth_codes')){
          const [codeHash,userId,challenge,expiresAt]=this.args;
          pending={codeHash,userId,challenge,expiresAt};
        }
        return {success:true};
      }};
    return statement;
  }};
  return {DB,calls};
}
const request=(path,body,{cookie=false,originHeader=origin}={})=>new Request(origin+path,{
  method:'POST',
  headers:{Origin:originHeader,'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.10',
    ...(cookie?{Cookie:'__Host-yv_member=browser-session'}:{})},
  body:JSON.stringify(body),
});
async function challenge(verifier){
  return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');
}

test('mobile Google handoff consumes a short-lived PKCE code exactly once',async()=>{
  const {DB,calls}=fakeDb(),env={DB};
  const state='s'.repeat(43),verifier='v'.repeat(43),codeChallenge=await challenge(verifier);
  const start=await handoff({request:request('/api/auth/mobile-handoff',{
    state,code_challenge:codeChallenge,code_challenge_method:'S256',
  },{cookie:true}),env});
  assert.equal(start.status,201);
  const {code}=await start.json();
  assert.match(code,/^[A-Za-z0-9_-]{43}$/);
  const stored=calls.find(x=>x.sql.startsWith('INSERT INTO mobile_auth_codes'));
  assert.ok(stored);
  assert.notEqual(stored.args[0],code);
  assert.equal(stored.args[2],codeChallenge);

  const finish=()=>exchange({request:request('/api/auth/mobile-exchange',{
    code,code_verifier:verifier,
  }),env});
  const response=await finish();
  assert.equal(response.status,200);
  assert.match(response.headers.get('set-cookie'),/^__Host-yv_member=/);
  assert.deepEqual(await response.json(),{ok:true,user:{id:user.id,email:user.email}});
  assert.equal((await finish()).status,401);
});

test('mobile Google handoff rejects untrusted origins and missing browser sessions',async()=>{
  const {DB}=fakeDb(),env={DB};
  const body={state:'s'.repeat(43),code_challenge:'c'.repeat(43),code_challenge_method:'S256'};
  assert.equal((await handoff({request:request('/api/auth/mobile-handoff',body,{originHeader:'https://attacker.example'}),env})).status,403);
  assert.equal((await handoff({request:request('/api/auth/mobile-handoff',body),env})).status,401);
});
