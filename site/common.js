import { createClient } from './vendor/supabase.js';
export const $ = id => document.getElementById(id);
export const CFG = window.YUKBUL_CONFIG || {};
const adminPage = location.pathname.startsWith('/admin');
// Retire previously persistent sessions. A fresh browser/tab never inherits an admin login.
for (const key of Object.keys(localStorage)) if (/^(yb-.*auth|sb-.*-auth-token)/.test(key)) localStorage.removeItem(key);

export const db = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(CFG.SUPABASE_URL || '') && /^sb_publishable_/.test(CFG.SUPABASE_PUBLISHABLE_KEY || '')
  ? createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: 'pkce', persistSession: true, storage: sessionStorage, autoRefreshToken: true, detectSessionInUrl: !adminPage, storageKey: adminPage ? 'yb-admin-auth' : 'yb-member-auth' } }) : null;
export const labels = { crane:'Mobil vinç / Hiyap', basket:'Sepetli vinç', lift:'Nakliyat asansörü', machine:'İş makinesi', tow:'Oto kurtarıcı / Yol yardım', operator:'Operatör / İş arıyorum', transport:'Evden eve nakliyat' };
export const icons = { crane:'🏗️', basket:'🪜', lift:'🏢', machine:'🚜', tow:'🚛', operator:'🦺', transport:'📦' };
export const statusLabels = { pending:'Onay bekliyor', approved:'Onaylı', rejected:'Reddedildi' };
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function money(n) { return n === null || n === '' ? 'Teklif al' : new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(n)); }
export function phone(value) { let n=String(value).replace(/\D/g,''); if(n.startsWith('0090'))n=n.slice(4);if(n.startsWith('90')&&n.length===12)n=n.slice(2);if(n.startsWith('0'))n=n.slice(1);return /^[2-5]\d{9}$/.test(n)?`+90${n}`:''; }
let toastTimer;
export function toast(message) { $('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),5000); }
const previousFocus=new Map();
export function openModal(id) { previousFocus.set(id,document.activeElement);$(id).classList.add('open');document.body.style.overflow='hidden';setTimeout(()=>$(id).querySelector('button,input,select,textarea')?.focus(),0); }
export function closeModal(id) { $(id).classList.remove('open');if(!document.querySelector('.modal-backdrop.open'))document.body.style.overflow='';previousFocus.get(id)?.focus(); }
document.addEventListener('click',e=>{const b=e.target.closest('[data-close]');if(b)closeModal(b.dataset.close);if(e.target.classList.contains('modal-backdrop'))closeModal(e.target.id);});
document.addEventListener('keydown',e=>{const modal=[...document.querySelectorAll('.modal-backdrop.open')].at(-1);if(!modal)return;if(e.key==='Escape')closeModal(modal.id);if(e.key==='Tab'){const nodes=[...modal.querySelectorAll('button,a[href],input,textarea,select,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
export function friendly(error) {
 const m=error?.message || String(error);const codes={EMAIL_UNVERIFIED:'İlan vermeden önce e-posta adresini doğrula.',UPLOAD_FAILED:'Fotoğraf yüklenemedi. Biraz sonra tekrar dene.',SERVER_ERROR:'Sunucu işlemi tamamlayamadı. Yeniden denemeden önce bağlantını kontrol et.',GOOGLE_REQUIRED:'İlan vermek için Google hesabınla giriş yap.',ACCOUNT_BLOCKED:'Hesabınızın işlem yetkisi kapatılmış. Yöneticiyle iletişime geçin.',TRIAL_EXPIRED:'Makine ilanları için deneme süreniz bitti. Üyelik etkinleştirilene kadar yeni makine ilanı gönderemezsiniz. Hizmet aramak ücretsizdir.',RATE_LIMIT_MINUTE:'Yeni ilan göndermek için en az 60 saniye bekleyin.',RATE_LIMIT_DAY:'24 saat içinde en fazla 3 ilan gönderebilirsiniz.',DUPLICATE_LISTING:'Bu içerik veya aynı iletişim bilgileriyle bu ilan zaten kayıtlı.',REPORT_LIMIT:'Günlük şikayet sınırına ulaştınız.',ADMIN_REQUIRED:'Bu hesapta yönetici yetkisi bulunmuyor.',CAPTCHA_REQUIRED:'Lütfen bot doğrulamasını tamamlayın.',CAPTCHA_FAILED:'Bot doğrulaması geçersiz veya süresi dolmuş. Yeniden deneyin.',INVALID_IMAGES:'1–6 geçerli fotoğraf yükleyin.',SETUP_REQUIRED:'Sunucu kurulumu tamamlanmamış. Kurulum rehberini kontrol edin.',INVALID_INPUT:'Form alanlarını kontrol edin.',AUTH_REQUIRED:'Devam etmek için giriş yapın.'};
 for(const [code,text] of Object.entries(codes))if(m.includes(code))return text;
 if(error?.code==='23505'||m.includes('duplicate key'))return 'Aynı ilan veya şikayet zaten kayıtlı.';
 if(error?.status===429)return 'Çok fazla istek gönderildi. Biraz bekleyip tekrar deneyin.';
 if(/Email not confirmed/i.test(m))return 'E-postandaki doğrulama bağlantısını açtıktan sonra giriş yap.';
 if(/Database error saving new user/i.test(m))return 'Kayıt veritabanına yazılamadı. Yöneticiye kayıt hatasını bildirin.';
 if(/Invalid login credentials/i.test(m))return 'E-posta veya şifre hatalı.';
 if(/captcha/i.test(m))return 'Bot doğrulamasını yenileyip tekrar deneyin.';
 if(/Failed to fetch|Network|network/i.test(m))return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.';
 return 'İşlem tamamlanamadı. Kurulum ve erişim ayarlarını kontrol edip yeniden deneyin.';
}
export async function member() { if(!db)throw Error('SETUP_REQUIRED');const {data:{user},error}=await db.auth.getUser();if(error||!user)return null;const r=await db.from('yb_members').select('*').eq('id',user.id).single();if(r.error)throw r.error;return {...r.data,user}; }
export async function signedPhotos(paths) { if(!paths?.length||!db)return [];const r=await db.storage.from('listing-images').createSignedUrls(paths,60);return r.error?[]:(r.data||[]).map(x=>x.signedUrl||''); }
export async function sanitizedImage(file) {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3*1024*1024)throw Error('INVALID_IMAGES');
 const bitmap=await createImageBitmap(file);const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.86));if(!blob||blob.size>3*1024*1024)throw Error('INVALID_IMAGES');return new File([blob],'photo.webp',{type:'image/webp'});
}
let turnstileLoading;const widgets=new Map();
export async function mountCaptcha(id,action) {
 const key=action==='admin'?CFG.AUTH_TURNSTILE_SITE_KEY:CFG.TURNSTILE_SITE_KEY;
 if(!key){$(id).textContent=action==='admin'?'':'İlan gönderimi için bot koruması kurulumu bekleniyor.';return;}
 if(!turnstileLoading)turnstileLoading=new Promise((resolve,reject)=>{if(window.turnstile)return resolve();const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=()=>resolve();s.onerror=()=>reject(Error('CAPTCHA_FAILED'));document.head.append(s);});
 await turnstileLoading;if(!widgets.has(id)){widgets.set(id,window.turnstile.render($(id),{sitekey:key,action,language:'tr',theme:'auto'}));}else window.turnstile.reset(widgets.get(id));
}
export function captchaToken(id) { return widgets.has(id)?window.turnstile.getResponse(widgets.get(id)):''; }
export function resetCaptcha(id) { if(widgets.has(id))window.turnstile.reset(widgets.get(id)); }
export function membershipText(m) {
 if(!m.trial_started_at)return 'Hizmet aramak ve operatör ilanı vermek ücretsizdir. Makine sahiplerinin 30 günlük denemesi ilk makine ilanı onaylandığında başlar. Kart bilgisi istenmez.';
 const until=Math.max(new Date(m.trial_ends_at||0).getTime(),new Date(m.paid_until||0).getTime());const diff=until-Date.now();if(diff<=0)return 'Makine ilanları için ücretsiz denemeniz bitti. Bu ilanlar üyelik etkinleştirilene kadar görünmez. Ödeme altyapısı henüz açılmadı; otomatik ücret alınmaz. Hizmet aramak ve operatör ilanı vermek ücretsizdir.';
 const days=Math.floor(diff/86400000),hours=Math.floor(diff%86400000/3600000),mins=Math.floor(diff%3600000/60000);return `Makine ilanı kullanım süresi: ${days} gün ${hours} saat ${mins} dakika. Bitiş: ${new Date(until).toLocaleString('tr-TR')}. Otomatik tahsilat yok.`;
}
export function locate() {return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(Error('Konum özelliği desteklenmiyor.'));navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),()=>reject(Error('Konum izni alınamadı. Şehir/ilçe ile arayabilir veya işletme koordinatlarını elle girebilirsin.')),{enableHighAccuracy:true,timeout:12000,maximumAge:60000});});}

// Recovery is handled on the root URL too, including dashboard-generated emails.
let recoveryUser=null;
function recoveryPanel(message='') {
 if(!$('password-recovery-modal'))document.body.insertAdjacentHTML('beforeend',`<div id="password-recovery-modal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="recovery-title"><div class="modal"><button class="close" data-close="password-recovery-modal" aria-label="Kapat">✕</button><h3 id="recovery-title">Yeni şifre belirle</h3><p class="page-note">YükBul hesabın için yeni bir şifre seç. Google şifren değişmez.</p><form id="recovery-form"><div class="formrow"><label for="recovery-password">Yeni şifre (en az 12 karakter)</label><input id="recovery-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div><div class="formrow"><label for="recovery-confirm">Yeni şifre tekrar</label><input id="recovery-confirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div><button class="btn primary" id="recovery-save">Şifreyi kaydet</button></form><p id="recovery-message" role="status"></p><a href="/reset-password/" id="recovery-again" hidden>Yeni sıfırlama bağlantısı iste</a><a href="/admin/" id="recovery-done" hidden>Yönetici girişine git</a></div></div>`);
 document.querySelectorAll('.modal-backdrop.open').forEach(n=>n.classList.remove('open'));
 $('recovery-message').textContent=message;$('recovery-form').hidden=!recoveryUser;$('recovery-again').hidden=!!recoveryUser;
 openModal('password-recovery-modal');
 $('recovery-form').onsubmit=async e=>{
  e.preventDefault();const a=$('recovery-password'),b=$('recovery-confirm');
  if(a.value!==b.value){$('recovery-message').textContent='Şifreler aynı değil.';return;}
  if(!e.currentTarget.reportValidity())return;
  $('recovery-save').disabled=true;
  try{
   const {data:{user},error:verifyError}=await db.auth.getUser();
   if(verifyError||!user||user.id!==recoveryUser)throw Error('RECOVERY_EXPIRED');
   const {error}=await db.auth.updateUser({password:a.value});if(error)throw error;
   a.value='';b.value='';recoveryUser=null;$('recovery-form').hidden=true;
   const logout=await db.auth.signOut({scope:'global'});
   $('recovery-message').textContent=logout.error?'Şifre değişti. Yönetici girişine yeni şifrenle devam edebilirsin. Diğer oturumların kapatılması doğrulanamadı.':'Şifren değiştirildi. Yeni şifrenle yönetici paneline giriş yapabilirsin.';
   $('recovery-done').hidden=false;
  }catch(error){
   $('recovery-message').textContent=error.message==='RECOVERY_EXPIRED'?'Bağlantı geçersiz veya süresi dolmuş. Yeni bağlantı iste.':error.code==='same_password'?'Öncekinden farklı bir şifre seç.':error.code==='weak_password'?'Daha güçlü bir şifre seç. En az 12 karakter, harf, rakam ve sembol kullan.':'Şifre kaydedilemedi. Bağlantının süresi dolmuş olabilir; yeni bağlantı iste.';
   $('recovery-again').hidden=false;
  }finally{$('recovery-save').disabled=false;}
 };
}
if(db&&!adminPage){
 const incomingHash=new URLSearchParams(location.hash.slice(1));
 const incomingQuery=new URLSearchParams(location.search);
 const recoveryIncoming=incomingHash.get('type')==='recovery'||sessionStorage.getItem('yb-auth-intent')==='recovery';
 db.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'&&session?.user){
   recoveryUser=session.user.id;sessionStorage.removeItem('yb-next');sessionStorage.removeItem('yb-auth-intent');
   history.replaceState(null,'',location.pathname);
   setTimeout(()=>recoveryPanel(),0);
  }
 });
 if(incomingHash.has('error')||incomingQuery.has('error')){
  history.replaceState(null,'',location.pathname);
  setTimeout(()=>{if(recoveryIncoming)recoveryPanel('Bağlantı geçersiz veya süresi dolmuş. Yeni bağlantı iste.');else toast('Giriş tamamlanamadı. Google ile tekrar giriş yapın.');},0);
 }else if(recoveryIncoming){
  db.auth.getSession().then(({data,error})=>{if(error||!data.session)setTimeout(()=>recoveryPanel('Bağlantı doğrulanamadı. E-postayı talep ettiğin tarayıcıda aç veya yeni bağlantı iste.'),0);});
 }
}

// Supabase owns hashing, token issuance and refresh. No password or JWT is embedded here.
export async function logout() {
 try { await db?.rpc('yb_session_event',{p_event:'logout'}); } catch {}
 let remoteError=null;
 try { const r=await db?.auth.signOut({scope:'local'});remoteError=r?.error; } catch(e) {remoteError=e;}
 finally {
  localStorage.clear();sessionStorage.clear();
  for(const cookie of document.cookie.split(';')) {
   const name=cookie.split('=')[0].trim();
   for(const path of ['/','/admin','/admin/','/reset-password','/reset-password/'])
    document.cookie=`${name}=; Max-Age=0; path=${path}; SameSite=Lax; Secure`;
  }
  try {const channel=new BroadcastChannel('yb-signout');channel.postMessage('logout');channel.close();}catch{}
 }
 return remoteError;
}
try {const channel=new BroadcastChannel('yb-signout');channel.onmessage=()=>{localStorage.clear();sessionStorage.clear();location.replace('/');};}catch{}
