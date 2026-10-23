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
    const id=randomId(16), encoded=await hashPassword(password);
    const created=await env.DB.prepare("INSERT INTO users(id,email,email_norm,password_hash,role) SELECT ?,?,?,?,'admin' WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='admin')").bind(id,email,email,encoded).run();
    if(!created.meta?.changes)return fail('İlk yönetici zaten oluşturulmuş. Kurulum bağlantısı kapalı.',409);
    await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash=?').bind(await ipHash(request)).run();
    await audit(env,id,'admin.bootstrap','user',id,{email});
    return json({ok:true,message:'Yönetici hesabı kuruldu. Şimdi giriş yap.'},201);
  }catch(e){return fail(e.message==='JSON bekleniyor.'?'Form verileri okunamadı.':'Kurulum tamamlanamadı; alanları ve D1 tablolarını kontrol et.',400);}
}
