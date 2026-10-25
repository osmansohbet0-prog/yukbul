'use strict';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
(async()=>{const auth=await fetch('/api/auth/me',{credentials:'same-origin'});if(!auth.ok){$('#account-login').hidden=false;return}const{user}=await auth.json();$('#account-view').hidden=false;$('#member-email').textContent=user.email;await load()})();
async function load(){
 const el=$('#my-listings');
 try{
  const response=await fetch('/api/listings/mine',{credentials:'same-origin'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error);
  const labels={pending:'Onay bekliyor',approved:'Yayında',rejected:'Reddedildi',flagged:'İnceleniyor'};
  const categoryLabels={crane:'Vinç',tow:'Oto kurtarıcı',basket:'Sepetli platform',manlift:'Manlift',machine:'İş makinesi',lift:'Nakliyat asansörü',operator:'Operatör iş ilanı'};
  el.innerHTML=data.items.length?data.items.map(item=>{
   const expiry=Number(item.paid_until||item.trial_expires_at||0);
   const days=expiry?Math.max(0,Math.ceil((expiry*1000-Date.now())/86400000)):null;
   const expired=Boolean(item.trial_expired);
   return `<article class="my-listing"><div><span class="status-pill status-${expired?'rejected':esc(item.status)}">${expired?'Askıda · ücretsiz süre bitti':labels[item.status]||esc(item.status)}</span><h2>${esc(item.title)}</h2><p>${categoryLabels[item.category]||esc(item.category)} · ${esc(item.city)} / ${esc(item.district)}</p><small>${item.category==='operator'?'Operatör iş arama ilanı ücretsizdir.':expired?'İlanın ücretsiz 30 günlük süresi dolduğu için yayından kaldırıldı. Ödeme yöntemi henüz etkin değil.':days!==null&&item.status==='approved'?`Ücretsiz yayın süresinin bitmesine ${days} gün kaldı.`:''}</small><small>${esc(item.moderation_note||'')}</small></div><div class="row-actions"><a class="reset-btn" href="/ilan-ver/?duzenle=${encodeURIComponent(item.id)}">Düzenle</a>${['flagged','rejected','pending'].includes(item.status)?`<button data-appeal="${esc(item.id)}">İncelemeye itiraz et</button>`:''}<button data-delete="${esc(item.id)}">İlanı kaldır</button></div></article>`;
  }).join(''):'<p class="empty-admin">Henüz ilan eklemedin.</p>';
  el.querySelectorAll('[data-appeal]').forEach(button=>button.addEventListener('click',async()=>{
 const message=prompt('İlanla ilgili açıklamanı yaz (10–1000 karakter):');if(!message)return;
 try{const r=await fetch('/api/listings/'+encodeURIComponent(button.dataset.appeal),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'appeal',message})});const d=await r.json();alert(d.message||d.error||'İşlem tamamlanamadı.')}catch{alert('Bağlantı kurulamadı. Daha sonra tekrar dene.')}
 }));
 el.querySelectorAll('[data-delete]').forEach(button=>{
   button.addEventListener('click',async()=>{
    if(!confirm('Bu ilanı kaldırmak istiyor musun?'))return;
    const result=await fetch('/api/listings/'+encodeURIComponent(button.dataset.delete),{method:'DELETE',credentials:'same-origin'});
    if(result.ok){await load();return}
    const details=await result.json();
    alert(details.error||'İlan kaldırılamadı.');
   });
  });
 }catch(error){el.textContent=error.message}
}
$('#member-logout').addEventListener('click',async()=>{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});location.replace('/')});

$('#change-password').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,status=$('#password-status');try{const r=await fetch('/api/auth/password',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({current_password:f.elements.current_password.value,new_password:f.elements.new_password.value})}),d=await r.json();if(!r.ok)throw Error(d.error);f.reset();status.textContent='Şifre güncellendi. Diğer oturumlar kapatıldı.'}catch(err){status.textContent=err.message;status.classList.add('bad')}});
