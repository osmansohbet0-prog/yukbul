import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as handoff} from '../functions/api/auth/mobile-handoff.js';
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
const request=(path,body,{cookie=false,originHeader=origin,method='POST',fetchSite}={})=>{
  const headers={'CF-Connecting-IP':'203.0.113.10'};
  if(originHeader)headers.Origin=originHeader;
  if(body!==undefined&&body!==null)headers['Content-Type']='application/json';
  if(cookie)headers.Cookie='__Host-yv_member=browser-session';
  if(fetchSite)headers['Sec-Fetch-Site']=fetchSite;
  return new Request(origin+path,{method,headers,body:body==null?undefined:JSON.stringify(body)});
};
async function challenge(verifier){
  return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');
}

test('mobile Google handoff consumes a short-lived PKCE code exactly once',async()=>{
  const {DB,calls}=fakeDb(),env={DB};
  const state='s'.repeat(43),verifier='v'.repeat(43),codeChallenge=await challenge(verifier);
  const path='/api/auth/mobile-handoff?app=android&state='+state+
    '&code_challenge='+codeChallenge+'&code_challenge_method=S256';
  const start=await handoff({request:request(path,null,{cookie:true,method:'GET',fetchSite:'same-origin'}),env});
  assert.equal(start.status,200);
  assert.equal(start.headers.get('cache-control'),'no-store, no-cache, must-revalidate');
  const html=await start.text();
  const callbackHref=/href="(yukvinc:\/\/auth\/callback\?[^"]+)"/.exec(html)?.[1]?.replaceAll('&amp;','&');
  assert.ok(callbackHref);
  const callback=new URL(callbackHref);
  assert.equal(callback.searchParams.get('state'),state);
  const code=callback.searchParams.get('code');
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

test('mobile Google handoff rejects cross-site, untrusted and unauthenticated requests',async()=>{
  const {DB}=fakeDb(),env={DB};
  const query='?app=android&state='+'s'.repeat(43)+'&code_challenge='+'c'.repeat(43)+'&code_challenge_method=S256';
  assert.equal((await handoff({request:request('/api/auth/mobile-handoff'+query,null,{cookie:true,method:'GET',originHeader:'https://attacker.example'}),env})).status,403);
  assert.equal((await handoff({request:request('/api/auth/mobile-handoff'+query,null,{cookie:true,method:'GET',fetchSite:'cross-site'}),env})).status,403);
  assert.equal((await handoff({request:request('/api/auth/mobile-handoff'+query,null,{method:'GET',fetchSite:'same-origin'}),env})).status,401);
});
