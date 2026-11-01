import {fail,json,isAllowedOrigin,readJson,rateLimited,noteAttempt,randomId,digest,keyedDigest,setCookie,audit,ipHash,equalSecret} from '../_lib/core.js';
export async function onRequestPost({request,env}) {
  if(!isAllowedOrigin(request))return fail('İstek kaynağı doğrulanamadı.',403);
  if(!env.DB)return fail('D1 bağlantısı henüz yapılmamış.',503);
  try{
    if(await rateLimited(env,request,8))return fail('Çok fazla giriş denemesi. Bir süre bekle.',429);
    await noteAttempt(env,request);
    const d=await readJson(request,2048), code=String(d.code||'').trim();
    const adminEmail=String(env.ADMIN_EMAIL||'').trim().toLowerCase();
    if(!adminEmail)return fail('Yönetici e-postası Cloudflare Secret olarak ayarlanmalı.',503);
    if(!/^\d{6}$/.test(code))return fail('Kod hatalı veya süresi dolmuş.',401);
    const user=await env.DB.prepare("SELECT id,email FROM users WHERE email_norm=? AND role='admin' AND active=1").bind(adminEmail).first();
    if(!user)return fail('Kod hatalı veya süresi dolmuş.',401);
    const now=Math.floor(Date.now()/1000);
    const challenge=await env.DB.prepare('SELECT code_hash,expires_at,attempts,used_at FROM admin_login_codes WHERE email_norm=?').bind(adminEmail).first();
    if(!challenge||Number(challenge.expires_at)<=now||challenge.used_at||Number(challenge.attempts)>=5)return fail('Kod hatalı veya süresi dolmuş. Yeni kod iste.',401);
    const codeHash=await keyedDigest(code,env.ADMIN_SECURITY_CODE||'');
    if(!equalSecret(codeHash,challenge.code_hash)){
      await env.DB.prepare('UPDATE admin_login_codes SET attempts=attempts+1 WHERE email_norm=? AND used_at IS NULL AND attempts<5').bind(adminEmail).run();
      return fail('Kod hatalı veya süresi dolmuş.',401);
    }
    const claimed=await env.DB.prepare('UPDATE admin_login_codes SET used_at=? WHERE email_norm=? AND code_hash=? AND expires_at>? AND attempts<5 AND used_at IS NULL').bind(now,adminEmail,codeHash,now).run();
    if(!Number(claimed.meta?.changes||0))return fail('Kod daha önce kullanılmış veya süresi dolmuş. Yeni kod iste.',401);
    const token=randomId(32), tokenHash=await digest(token), expires=now+1800;
    await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').bind(now).run();
    await env.DB.prepare('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(tokenHash,user.id,expires).run();
    await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash=?').bind(await ipHash(request)).run();
    await env.DB.prepare('DELETE FROM admin_login_codes WHERE email_norm=?').bind(adminEmail).run();
    await audit(env,user.id,'admin.login','session',null,{});
    return json({ok:true,user:{email:user.email},expires_at:expires},200,{'set-cookie':setCookie(token)});
  }catch{return fail('Giriş işlemi şu an tamamlanamadı.',400);}
}
