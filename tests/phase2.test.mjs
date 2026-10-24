import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SITE,validateSettings,hashPassword,verifyPassword,equalSecret,setCookie} from '../functions/_lib/core.js';
import {onRequestPost as adminLogin} from '../functions/api/admin-login.js';
import {onRequestPut} from '../functions/api/admin-settings.js';

test('default public theme is valid and uses only approved settings',()=>{
 assert.equal(validateSettings(DEFAULT_SITE),null);
 assert.equal(validateSettings({...DEFAULT_SITE,font_family:'url(javascript:alert(1))'}),'Yazı tipi listede değil.');
 assert.match(validateSettings({...DEFAULT_SITE,primary_color:'red'}),/Renk/);
 assert.match(validateSettings({...DEFAULT_SITE,logo_path:'//evil.example/logo.svg'}),/dosya yolu/);
 assert.match(validateSettings({...DEFAULT_SITE,section_order:['ilanlar','ilanlar','about','faq','closing']}),/sırası/);
});

test('passwords are salted and verify without storing plaintext',async()=>{
 const first=await hashPassword('OrnekGucluSifre123!');
 const second=await hashPassword('OrnekGucluSifre123!');
 assert.notEqual(first,second);
 assert.match(first,/^pbkdf2\$210000\$/);
 assert.equal(await verifyPassword('OrnekGucluSifre123!',first),true);
 assert.equal(await verifyPassword('yanlis-sifre',first),false);
 assert.equal(first.includes('OrnekGucluSifre123!'),false);
});

test('legacy 100000-iteration password hashes remain valid during gradual upgrade',async()=>{assert.equal(await verifyPassword('OrnekGucluSifre123!','pbkdf2$100000$CnbnZIXNSWfYS20FRZ_yYg$ronHS2dF9qk6Wcx2bac-zt7h310-bVpO1swMYnmDZ1I'),true)});

test('settings write blocks cross-origin requests and unauthenticated writes',async()=>{
 const env={DB:{prepare(){throw new Error('should not query before auth/origin validation')}}};
 const evil=new Request('https://yukvinc.com.tr/api/admin-settings',{method:'PUT',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
 assert.equal((await onRequestPut({request:evil,env})).status,403);
 const noSession=new Request('https://yukvinc.com.tr/api/admin-settings',{method:'PUT',headers:{Origin:'https://yukvinc.com.tr','Content-Type':'application/json'},body:'{}'});
 assert.equal((await onRequestPut({request:noSession,env})).status,401);
});

test('admin security code is a separate required secret and session cookie is hardened',async()=>{
 assert.equal(equalSecret('same-code','same-code'),true);
 assert.equal(equalSecret('same-code','other-code'),false);
 assert.match(setCookie('opaque-token'),/HttpOnly; Secure; SameSite=Strict/);
 assert.match(setCookie('opaque-token'),/Path=\//);
 const request=new Request('https://yukvinc.com.tr/api/admin-login',{method:'POST',headers:{Origin:'https://yukvinc.com.tr','Content-Type':'application/json'},body:JSON.stringify({email:'admin@example.com',password:'long-password',security_code:'anything'})});
 assert.equal((await adminLogin({request,env:{DB:{}}})).status,503);
});
