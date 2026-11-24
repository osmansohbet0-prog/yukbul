import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword} from '../functions/_lib/core.js';
import {onRequestPost} from '../functions/api/admin-login.js';

async function fixture({password='GucluYoneticiSifresi123!',securityCode='guvenlik-kodu-1234'}={}) {
  const storedHash=await hashPassword('GucluYoneticiSifresi123!');
  const writes=[];
  const DB={prepare(sql){return{args:[],bind(...args){this.args=args;return this},async first(){
    if(sql.includes('SELECT COUNT(*) AS n FROM admin_login_attempts'))return{n:0};
    if(sql.includes('SELECT id,email,password_hash FROM users'))return{id:'admin_123456',email:'admin@example.test',password_hash:storedHash};
    return null;
  },async run(){writes.push({sql,args:this.args});return{meta:{changes:1}}}}}};
  const request=new Request('https://yukvinc.com.tr/api/admin-login',{method:'POST',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json','cf-connecting-ip':'192.0.2.22'},body:JSON.stringify({email:'admin@example.test',password,security_code:securityCode})});
  return{context:{request,env:{DB,ADMIN_EMAIL:'admin@example.test',ADMIN_SECURITY_CODE:'guvenlik-kodu-1234'}},writes};
}

test('valid admin credentials create a secure session and return the expected login user',async()=>{
  const f=await fixture();
  const response=await onRequestPost(f.context);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(data.user,{email:'admin@example.test'});
  assert.match(response.headers.get('set-cookie'),/^__Host-yv_admin=.+; Path=\/; Max-Age=/);
  assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.ok(f.writes.some(x=>x.sql.startsWith('INSERT INTO admin_sessions')));
  assert.ok(f.writes.some(x=>x.args?.[1]==='admin.login'));
});

test('invalid password or security code never creates an admin session',async()=>{
  for(const options of [{password:'yanlis-sifre'},{securityCode:'yanlis-kod'}]){
    const f=await fixture(options);
    const response=await onRequestPost(f.context);
    assert.equal(response.status,401);
    assert.equal(f.writes.some(x=>x.sql.startsWith('INSERT INTO admin_sessions')),false);
  }
});
