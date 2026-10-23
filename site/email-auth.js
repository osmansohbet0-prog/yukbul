import {$,CFG,db,mountCaptcha,captchaToken,resetCaptcha,friendly} from './common.js';
const modal=$('auth-message');
if(modal){
 modal.insertAdjacentHTML('beforebegin',`<form id="email-auth" class="auth-email"><h4>E-posta ile giriş / hesap oluştur</h4><div class="formrow"><label for="member-email">E-posta</label><input id="member-email" type="email" autocomplete="username" maxlength="254" required></div><div class="formrow"><label for="member-password">Şifre</label><input id="member-password" type="password" autocomplete="current-password" minlength="12" maxlength="128" required></div><div id="member-captcha"></div><div class="row"><button class="btn primary" value="login">Giriş yap</button><button class="btn light" value="register">Hesap oluştur</button></div><a href="/reset-password/">Şifremi unuttum</a></form>`);
 const observer=new MutationObserver(()=>{if($('auth-modal').classList.contains('open'))mountCaptcha('member-captcha','admin').catch(()=>{modal.textContent='Bot doğrulaması yüklenemedi.';});});observer.observe($('auth-modal'),{attributes:true,attributeFilter:['class']});
 $('email-auth').onsubmit=async e=>{
  e.preventDefault();const buttons=[...e.currentTarget.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{
   if(!db)throw Error('SETUP_REQUIRED');const token=captchaToken('member-captcha');if(CFG.AUTH_TURNSTILE_SITE_KEY&&!token)throw Error('CAPTCHA_REQUIRED');
   const credentials={email:$('member-email').value.trim(),password:$('member-password').value};
   sessionStorage.setItem('yb-auth-intent',e.submitter?.value==='register'?'signup':'login');
   const result=e.submitter?.value==='register'?await db.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+'/',...(token?{captchaToken:token}:{})}}):await db.auth.signInWithPassword({...credentials,options:token?{captchaToken:token}:{}});
   if(result.error)throw result.error;
   $('member-password').value='';
   if(result.data.session)window.dispatchEvent(new Event('yb-login'));
   else modal.textContent='Adres uygunsa doğrulama e-postası gönderildi. Gelen kutunu kontrol edip bağlantıyı bu tarayıcıda aç.';
  }catch(error){modal.textContent=friendly(error);}
  finally{buttons.forEach(b=>b.disabled=false);resetCaptcha('member-captcha');}
 };
}
