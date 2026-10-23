import {$,db,esc,logout} from '../common.js';
let expiresAt=0;
export async function requireAdmin(){
 const candidate=await db.rpc('yb_admin_candidate');
 if(candidate.error||!candidate.data)throw Error('ADMIN_REQUIRED');
 const gate=await db.rpc('yb_admin_ok');
 if(!gate.error&&gate.data){
  const session=await db.auth.getSession();
  try{const part=session.data.session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const claims=JSON.parse(atob(part));const times=(claims.amr||[]).filter(x=>x.method==='totp').map(x=>Number(x.timestamp)*1000);expiresAt=Math.max(...times)+15*60*1000;}catch{}
  $('admin-mfa').hidden=true;return;
 }
 $('admin-panel').hidden=true;$('admin-login').hidden=true;$('admin-mfa').hidden=false;$('admin-signout').hidden=false;
 const factors=await db.auth.mfa.listFactors();if(factors.error)throw factors.error;
 let factor=factors.data.totp.find(x=>x.status==='verified');
 $('mfa-setup').replaceChildren();
 if(!factor){
  $('mfa-setup').innerHTML='<p>Telefonundaki doğrulama uygulamasını aç. “Kurulumu başlat” ile QR kodunu ekle; ardından 6 haneli kodu yaz. SMS gönderilmez.</p><button class="btn primary" id="mfa-enroll">Kurulumu başlat</button>';
  $('mfa-enroll').onclick=async()=>{
   $('mfa-enroll').disabled=true;
   try{
    // Remove only unfinished TOTP enrollments from this owner account.
    for(const f of factors.data.all.filter(x=>x.factor_type==='totp'&&x.status==='unverified'))await db.auth.mfa.unenroll({factorId:f.id});
    const r=await db.auth.mfa.enroll({factorType:'totp',friendlyName:'YükBul Yönetim'});if(r.error)throw r.error;
    factor=r.data;const img=document.createElement('img');img.alt='Doğrulama uygulaması kurulum QR kodu';img.width=220;img.src=r.data.totp.qr_code;
    $('mfa-setup').replaceChildren(img);
   }catch{$('mfa-message').textContent='Kurulum başlatılamadı. Yeniden giriş yapıp deneyin.';}
  };
 }
 $('mfa-form').onsubmit=async e=>{
  e.preventDefault();const button=$('mfa-submit');button.disabled=true;
  try{
   if(!factor)throw Error('SETUP');
   const r=await db.auth.mfa.challengeAndVerify({factorId:factor.id,code:$('mfa-code').value.trim()});if(r.error)throw r.error;
   $('mfa-code').value='';$('mfa-setup').replaceChildren();expiresAt=Date.now()+15*60*1000;
   await db.rpc('yb_session_event',{p_event:'login'});
   window.dispatchEvent(new Event('yb-admin-ready'));
  }catch{$('mfa-message').textContent='Kod doğrulanamadı. Uygulamadaki güncel kodu girin.';}
  finally{button.disabled=false;}
 };
 throw Error('MFA_REQUIRED');
}
setInterval(()=>{if(expiresAt&&Date.now()>expiresAt){expiresAt=0;$('admin-panel').hidden=true;requireAdmin().catch(()=>{});}},10000);
export async function renderActivity(){
 const r=await db.rpc('yb_admin_activity',{p_offset:0});if(r.error)throw r.error;
 const names={login:'Giriş',logout:'Çıkış',user_signedup:'Hesap oluşturma',user_recovery_requested:'Şifre yenileme isteği',mfa_verification:'Güvenlik kodu doğrulama',listing_update:'İlan güncelleme',listing_create:'İlan oluşturma',settings_update:'Site içeriği güncelleme'};
 $('admin-results').innerHTML='<p class="page-note">Son 50 işlem. Sekmeyi kapatmak çıkış işlemi sayılmaz; bu liste çevrimiçi kullanıcı sayacı değildir.</p>'+((r.data||[]).map(x=>`<article class="admin-card"><strong>${esc(names[x.action]||x.action)}</strong><p>${esc(x.source==='supabase_auth'?'Kimlik sunucusu':'Site işlemi')} · ${esc(x.email)} · ${esc(new Date(x.created_at).toLocaleString('tr-TR'))}</p></article>`).join('')||'<p>Henüz kayıt yok.</p>');
}
