import {fail,json,isAllowedOrigin,readJson,rateLimited,noteAttempt,verifyPassword,randomId,digest,setCookie,audit,ipHash,equalSecret} from '../_lib/core.js';
const DUMMY='pbkdf2$100000$MDEyMzQ1Njc4OWFiY2RlZg$4iB6f3p-jfQ5csC8mIi0oGZleGrJ2z1Tl3taRaVsmxM';
export async function onRequestPost({request,env}) {
  if(!isAllowedOrigin(request))return fail('İstek kaynağı doğrulanamadı.',403);
  if(!env.DB)return fail('D1 bağlantısı henüz yapılmamış.',503);
  if(!env.ADMIN_SECURITY_CODE||env.ADMIN_SECURITY_CODE.length<8)return fail('Yönetici güvenlik kodu Cloudflare Secret olarak ayarlanmalı.',503);
  try{
    if(await rateLimited(env,request,5))return fail('Çok fazla giriş denemesi. 15 dakika bekle.',429);
    await noteAttempt(env,request);
    const d=await readJson(request,4096), email=String(d.email||'').trim().toLowerCase(), password=String(d.password||''), securityCode=String(d.security_code||'');
    const adminEmail=String(env.ADMIN_EMAIL||'').trim().toLowerCase();
    if(!adminEmail)return fail('Yönetici e-postası Cloudflare Secret olarak ayarlanmalı.',503);
    if(email!==adminEmail)return fail('E-posta, şifre veya güvenlik kodu hatalı.',401);
    if(email.length>254||password.length>128||securityCode.length>128)return fail('E-posta, şifre veya güvenlik kodu hatalı.',401);
    const user=await env.DB.prepare("SELECT id,email,password_hash FROM users WHERE email_norm=? AND role='admin' AND active=1").bind(email).first();
    const valid=await verifyPassword(password,user?.password_hash||DUMMY);
    if(!user||!valid||!equalSecret(securityCode,env.ADMIN_SECURITY_CODE))return fail('E-posta, şifre veya güvenlik kodu hatalı.',401);
    const token=randomId(32), tokenHash=await digest(token), now=Math.floor(Date.now()/1000), expires=now+1800;
    await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').bind(now).run();
    await env.DB.prepare('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(tokenHash,user.id,expires).run();
    await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash=?').bind(await ipHash(request)).run();
    await audit(env,user.id,'admin.login','session',null,{});
    return json({ok:true,user:{email:user.email},expires_at:expires},200,{'set-cookie':setCookie(token)});
  }catch{return fail('Giriş işlemi şu an tamamlanamadı.',400);}
}
