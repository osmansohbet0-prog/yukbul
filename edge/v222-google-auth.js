'use strict';
(()=>{
  if(document.documentElement.dataset.yvGoogleAuth==='loaded')return;
  document.documentElement.dataset.yvGoogleAuth='loaded';
  const one=sel=>document.querySelector(sel),form=one('#auth-form');
  if(!form)return;
  let mode='login',siteKey='',googleClientId='',widget=null,busy=false,googleRendered=false;
  const status=one('#auth-status'),tabs=[...document.querySelectorAll('[data-auth-tab]')];
  const googleWrap=one('#google-auth-container'),googleButton=one('#google-auth-button');
  const authButton=one('#auth-submit'),turnBox=one('#turnstile-box');
  const statusGoogle=document.createElement('p');
  statusGoogle.id='yv-google-status';statusGoogle.className='form-status yv-google-status';
  statusGoogle.setAttribute('role','status');statusGoogle.setAttribute('aria-live','polite');
  googleButton?.insertAdjacentElement('afterend',statusGoogle);
  const tell=(message,bad=false)=>{
    if(status){status.textContent=message;status.classList.toggle('bad',bad)}
    if(statusGoogle){statusGoogle.textContent=message;statusGoogle.classList.toggle('bad',bad)}
  };
  function lock(value){
    busy=value;
    document.body.classList.toggle('yv-google-busy',value);
    form.setAttribute('aria-busy',String(value));
    for(const tab of tabs)tab.disabled=value;
    if(authButton)authButton.disabled=value;
    if(googleWrap)googleWrap.style.pointerEvents=value?'none':'';
    if(googleWrap)googleWrap.setAttribute('aria-busy',String(value));
    // Existing forms and menus remain untouched; only auth controls are locked.
  }
  const token=()=>{
    try{return widget!==null&&window.turnstile?window.turnstile.getResponse(widget)||'':''}catch{return''}
  };
  function resetCaptcha(){
    try{if(widget!==null&&window.turnstile)window.turnstile.reset(widget)}catch{}
  }
  function renderCaptcha(){
    if(widget!==null||!siteKey||!turnBox||!window.turnstile)return;
    try{
      turnBox.textContent='';
      widget=window.turnstile.render(turnBox,{
        sitekey:siteKey,action:'member_auth',theme:'light',
        callback:()=>{if(!busy)tell('')},
        'expired-callback':()=>{if(!busy)tell('Güvenlik doğrulamasının süresi doldu. Yeniden tamamla.',true)},
        'error-callback':()=>{if(!busy)tell('Güvenlik kontrolü yüklenemedi. Yeniden dene.',true)}
      });
    }catch{tell('Bot koruması açılmadı. Sayfayı yeniden yükle.',true)}
  }
  function injectScript(src,onload,onerror){
    const script=document.createElement('script');
    script.src=src;script.async=true;script.defer=true;
    script.onload=onload;script.onerror=onerror;
    document.head.append(script);
  }
  async function request(url,body,timeoutMs=20000){
    const abort=new AbortController();
    const timer=setTimeout(()=>abort.abort(),timeoutMs);
    try{
      const response=await fetch(url,{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify(body),signal:abort.signal
      });
      let data={};
      try{data=await response.json()}catch{}
      if(!response.ok)throw Error(data.error||data.message||(response.status===429?'Çok fazla deneme. Bir süre sonra tekrar dene.':'Giriş tamamlanamadı.'));
      return data;
    }finally{clearTimeout(timer)}
  }
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function checkSession(){
    // Cookies can become visible to a following request slightly after the login response.
    // Never redirect before the same-origin session is confirmed.
    for(const wait of [0,220,600]){
      if(wait)await pause(wait);
      try{
        const res=await fetch('/api/auth/me',{
          credentials:'same-origin',cache:'no-store',
          headers:{accept:'application/json'},
          signal:AbortSignal.timeout(4500)
        });
        if(res.ok){
          const data=await res.json();
          if(data?.user?.id)return true;
        }
      }catch{}
    }
    return false;
  }
  function redirect(){
    const requested=new URLSearchParams(location.search).get('next')||'/hesabim/';
    let target='/hesabim/';
    try{
      const dest=new URL(requested,location.origin);
      if(dest.origin===location.origin && requested.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\')){
        target=dest.pathname+dest.search+dest.hash;
      }
    }catch{}
    location.replace(target);
  }
  async function loginGoogle(result){
    if(busy)return;
    if(!result?.credential){tell('Google hesabı seçimi tamamlanmadı. Yeniden dene.',true);return}
    const captcha=token();
    if(!captcha){
      tell('Önce bot doğrulamasını tamamla, sonra Google hesabını yeniden seç.',true);
      return;
    }
    lock(true);
    tell('Google hesabın doğrulanıyor…');
    try{
      await request('/api/auth/google',{credential:result.credential,turnstile_token:captcha},22000);
      tell('Giriş başarılı. Oturumun hazırlanıyor…');
      const verified=await checkSession();
      if(!verified)throw Error('Google doğrulandı ancak oturum kontrolü tamamlanamadı. Tekrar dene.');
      tell('Hesabına yönlendiriliyorsun…');
      redirect();
    }catch(err){
      const hint=err?.name==='AbortError'?'Bağlantı zaman aşımına uğradı. Tekrar deneyebilirsin.':err?.message||'Google girişi tamamlanamadı.';
      tell(hint,true);
      resetCaptcha();
      lock(false);
    }
  }
  function loadGoogle(){
    if(!googleClientId||!googleButton)return;
    googleWrap.hidden=false;
    const onload=()=>{
      try{
        if(!window.google?.accounts?.id)throw Error('Google SDK erişilemedi');
        window.google.accounts.id.initialize({
          client_id:googleClientId,
          callback:loginGoogle,
          auto_select:false,
          cancel_on_tap_outside:true
        });
        if(googleRendered)return;
        googleButton.replaceChildren();
        window.google.accounts.id.renderButton(googleButton,{
          type:'standard',theme:'outline',size:'large',
          text:'continue_with',shape:'rectangular',locale:'tr',width:290
        });
        googleRendered=true;
        const hint=googleWrap.querySelector('.form-hint');
        if(hint)hint.textContent='Google hesabını seç; giriş tamamlanınca otomatik yönlendirileceksin.';
      }catch{
        tell('Google giriş düğmesi açılamadı. Tarayıcı gizlilik ayarlarını kontrol edip yeniden dene.',true);
      }
    };
    if(window.google?.accounts?.id){onload();return}
    injectScript('https://accounts.google.com/gsi/client',onload,
      ()=>tell('Google giriş hizmeti yüklenemedi. Bağlantını kontrol edip yeniden dene.',true));
  }
  function setMode(next){
    if(busy)return;
    mode=next==='register'?'register':'login';
    for(const tab of tabs){
      const active=tab.dataset.authTab===mode;
      tab.classList.toggle('selected',active);
      tab.setAttribute('aria-selected',String(active));
    }
    const confirmWrap=one('#password-confirm-wrap');
    const confirm=form.querySelector('input[name="confirm"]');
    if(confirmWrap)confirmWrap.hidden=mode!=='register';
    if(confirm){confirm.required=mode==='register';if(mode!=='register')confirm.value=''}
    const pwd=form.querySelector('input[name="password"]');
    if(pwd)pwd.autocomplete=mode==='register'?'new-password':'current-password';
    if(authButton)authButton.textContent=mode==='register'?'Ücretsiz hesap oluştur →':'Giriş yap →';
    // Crucial: never remove/recreate Turnstile on a tab switch. That invalidates Google login.
    tell('');
  }
  for(const tab of tabs)tab.addEventListener('click',()=>setMode(tab.dataset.authTab));
  if(new URLSearchParams(location.search).get('mode')==='register')setMode('register');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy)return;
    const elems=form.elements;
    if(elems.website?.value)return;
    const captcha=token();
    if(!captcha){tell('Önce bot doğrulamasını tamamla.',true);return}
    const pwd=form.querySelector('input[name="password"]'),confirm=form.querySelector('input[name="confirm"]');
    if(mode==='register'&&pwd?.value!==confirm?.value){tell('Şifreler eşleşmiyor.',true);return}
    lock(true);tell(mode==='register'?'Hesap oluşturuluyor…':'Giriş yapılıyor…');
    try{
      await request('/api/auth/'+mode,{
        email:elems.email.value,password:pwd.value,
        turnstile_token:captcha
      },22000);
      tell('Oturum hazırlanıyor…');
      if(!await checkSession())throw Error('Oturum doğrulanamadı. Yeniden dene.');
      redirect();
    }catch(err){
      tell(err?.name==='AbortError'?'Bağlantı zaman aşımına uğradı. Yeniden dene.':err?.message||'Giriş başarısız.',true);
      resetCaptcha();lock(false);
    }
  });
  async function init(){
    let config=window.__YV_AUTH_CONFIG||{};
    if(!config.turnstile_site_key||!config.google_client_id){
      try{
        const res=await fetch('/api/public-settings',{
          credentials:'same-origin',cache:'no-store',
          headers:{accept:'application/json'},
          signal:AbortSignal.timeout(8500)
        });
        if(!res.ok)throw Error('Ayarlar okunamadı');
        const data=await res.json();
        config={...config,...data};
      }catch{
        tell('Giriş ayarları alınamadı. Bağlantıyı kontrol edip sayfayı yeniden yükle.',true);
      }
    }
    siteKey=String(config.turnstile_site_key||'');
    googleClientId=String(config.google_client_id||'');
    if(siteKey){
      if(window.turnstile)renderCaptcha();
      else injectScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
        renderCaptcha,()=>tell('Bot doğrulaması yüklenemedi. Bağlantını kontrol et.',true));
    }else if(turnBox)turnBox.textContent='Bot güvenlik ayarı eksik. Site yöneticisine bildir.';
    loadGoogle();
    if(!googleClientId&&googleWrap)googleWrap.hidden=true;
  }
  init().catch(()=>tell('Giriş ekranı hazırlanamadı. Sayfayı yenile.',true));
})();
