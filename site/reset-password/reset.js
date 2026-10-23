import {$,CFG,db,mountCaptcha,captchaToken,resetCaptcha} from '../common.js';
mountCaptcha('reset-turnstile','admin').catch(()=>$('reset-status').textContent='Bot doğrulaması yüklenemedi. Sayfayı yenile.');
$('reset-request').onsubmit=async e=>{
 e.preventDefault();const button=$('reset-send');button.disabled=true;
 try{
  if(!db)throw Error('SETUP');const token=captchaToken('reset-turnstile');
  if(CFG.AUTH_TURNSTILE_SITE_KEY&&!token)throw Error('CAPTCHA');
  sessionStorage.setItem('yb-auth-intent','recovery');
  const {error}=await db.auth.resetPasswordForEmail($('reset-email').value.trim(),{redirectTo:new URL('/',location.origin).href,...(token?{captchaToken:token}:{})});
  if(error)throw error;
  $('reset-status').textContent='Adres uygunsa sıfırlama bağlantısı gönderildi. Gelen kutusu ve spam klasörünü kontrol et. Bağlantıyı bu tarayıcıda aç.';
  $('reset-request').hidden=true;
 }catch(error){$('reset-status').textContent=error.message==='CAPTCHA'?'Bot doğrulamasını tamamla.':error.status===429?'Çok fazla istek gönderildi. Bir süre sonra tekrar dene.':'E-posta gönderilemedi. Bot doğrulamasını ve Supabase e-posta ayarlarını kontrol et.';resetCaptcha('reset-turnstile');}
 finally{button.disabled=false;}
};
