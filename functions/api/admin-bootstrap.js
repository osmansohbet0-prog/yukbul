import {fail,json,isAllowedOrigin,readJson,rateLimited,noteAttempt,hashPassword,randomId,audit,ipHash,equalSecret,ADMIN_EMAIL} from '../_lib/core.js';
export async function onRequestPost({request,env}) {
  if(!isAllowedOrigin(request))return fail('İstek kaynağı doğrulanamadı.',403);
  if(!env.DB||!env.ADMIN_BOOTSTRAP_SECRET||env.ADMIN_BOOTSTRAP_SECRET.length<32)return fail('D1 veya en az 32 karakterli kurulum secret ayarlanmalı.',503);
  try{
    if(await rateLimited(env,request,5))return fail('Çok fazla deneme. 15 dakika sonra tekrar dene.',429);
    await noteAttempt(env,request);
    const d=await readJson(request,4096), secret=String(d.bootstrap_secret||''), email=String(d.email||'').trim().toLowerCase(), password=String(d.password||'');
    if(!equalSecret(secret,env.ADMIN_BOOTSTRAP_SECRET))return fail('Kurulum kodu hatalı.',403);
    if(email!==ADMIN_EMAIL)return fail('Yalnızca yetkili yönetici e-posta adresi kullanılabilir.',403);
    if(password.length<14||password.length>128)return fail('Şifre 14–128 karakter olmalı.');
    const encoded=await hashPassword(password);
    const existing=await env.DB.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").first();
    let id,status=201;
    if(existing){
      id=existing.id;status=200;
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET email=?,email_norm=?,password_hash=?,active=1,updated_at=unixepoch() WHERE id=? AND role='admin'").bind(ADMIN_EMAIL,ADMIN_EMAIL,encoded,id),
        env.DB.prepare('DELETE FROM admin_sessions WHERE user_id=?').bind(id)
      ]);
    }else{
      id=randomId(16);
      await env.DB.prepare("INSERT INTO users(id,email,email_norm,password_hash,role) VALUES(?,?,?,?,'admin')").bind(id,ADMIN_EMAIL,ADMIN_EMAIL,encoded).run();
    }
    await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash=?').bind(await ipHash(request)).run();
    await audit(env,id,existing?'admin.password_reset':'admin.bootstrap','user',id,{email:ADMIN_EMAIL});
    return json({ok:true,message:existing?'Yönetici hesabı güncellendi. Kurulum secret’ını kaldırıp giriş yap.':'Yönetici hesabı kuruldu. Kurulum secret’ını kaldırıp giriş yap.'},status);
  }catch(e){console.error('admin-bootstrap failed',e?.name||'Error',e?.message||'unknown');return fail(e.message==='JSON bekleniyor.'?'Form verileri okunamadı.':'Kurulum tamamlanamadı; Observability loglarını kontrol et.',500);}
}
