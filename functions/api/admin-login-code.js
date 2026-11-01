import {fail,json,isAllowedOrigin,rateLimited,noteAttempt,keyedDigest,audit} from '../_lib/core.js';

export async function onRequestPost({request,env}) {
  if(!isAllowedOrigin(request))return fail('İstek kaynağı doğrulanamadı.',403);
  if(!env.DB)return fail('Giriş hizmeti şu an hazır değil.',503);
  const adminEmail=String(env.ADMIN_EMAIL||'').trim().toLowerCase();
  const sender=String(env.LISTING_NOTIFICATION_FROM||'').trim();
  if(!adminEmail||!sender||!env.EMAIL||!env.ADMIN_SECURITY_CODE||env.ADMIN_SECURITY_CODE.length<8)return fail('E-posta kodu hizmeti henüz yapılandırılmadı.',503);
  try{
    if(await rateLimited(env,request,5))return fail('Çok fazla istek. Bir süre sonra tekrar dene.',429);
    await noteAttempt(env,request);
    const user=await env.DB.prepare("SELECT id FROM users WHERE email_norm=? AND role='admin' AND active=1").bind(adminEmail).first();
    if(!user)return json({ok:true,message:'Kod gönderildiyse kayıtlı yönetici e-postanı kontrol et.'});
    const now=Math.floor(Date.now()/1000);
    const prior=await env.DB.prepare('SELECT created_at FROM admin_login_codes WHERE email_norm=?').bind(adminEmail).first();
    if(prior&&now-Number(prior.created_at)<60)return json({ok:true,message:'Kod gönderildiyse kayıtlı yönetici e-postanı kontrol et.'});
    const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
    const code=String(bytes[0]%1000000).padStart(6,'0');
    const codeHash=await keyedDigest(code,env.ADMIN_SECURITY_CODE),expires=now+600;
    await env.DB.prepare("INSERT INTO admin_login_codes(email_norm,code_hash,expires_at,attempts,used_at,created_at) VALUES(?,?,?,0,NULL,?) ON CONFLICT(email_norm) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,used_at=NULL,created_at=excluded.created_at")
      .bind(adminEmail,codeHash,expires,now).run();
    try{
      await env.EMAIL.send({
        to:adminEmail,
        from:{email:sender,name:'YükVinç Yönetim'},
        subject:'YükVinç yönetici giriş kodu',
        text:`Yönetim paneli giriş kodun: ${code}\n\nKod 10 dakika geçerlidir ve tek kullanımlıktır. Bu isteği sen yapmadıysan bu e-postayı yok say.`,
        html:`<p>Yönetim paneline giriş için kodun:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Kod 10 dakika geçerlidir ve tek kullanımlıktır. Bu isteği sen yapmadıysan bu e-postayı yok say.</p>`
      });
    }catch(error){
      await env.DB.prepare('DELETE FROM admin_login_codes WHERE email_norm=? AND code_hash=?').bind(adminEmail,codeHash).run();
      console.error('[admin-login-code]',JSON.stringify({event:'email_failed',code:error?.code||'unknown'}));
      return fail('Giriş kodu gönderilemedi. E-posta ayarları kontrol edilmeli.',503);
    }
    await audit(env,user.id,'admin.login_code.sent','session',null,{});
    return json({ok:true,message:'Giriş kodu kayıtlı yönetici e-postana gönderildi. Kod 10 dakika geçerlidir.'});
  }catch(error){
    console.error('[admin-login-code]',JSON.stringify({event:'request_failed',code:error?.code||error?.name||'unknown'}));
    return fail('Kod isteği tamamlanamadı.',503);
  }
}
