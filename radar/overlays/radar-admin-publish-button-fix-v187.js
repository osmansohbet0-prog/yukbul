
(()=>{
'use strict';
const endpoint='/api/admin-radar-publish';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const official=x=>{try{const h=new URL(x.source_url).hostname.toLowerCase();return ['gov.tr','bel.tr'].some(t=>h===t||h.endsWith('.'+t))}catch{return false}};
const eligible=x=>official(x)&&['official_source','manual_reviewed'].includes(x.verification)&&['review','approved'].includes(x.status)&&['relevant','uncertain'].includes(x.classification);
function showMsg(message) {
 const output=document.querySelector('#lr-status')||document.querySelector('#global-status');
 if(output){output.textContent=message;output.setAttribute('role','alert')}
 else alert(message);
}
function updateButtons() {
 const parent=document.querySelector('#lr-items');if(!parent)return;
 parent.querySelectorAll('button[data-publish]').forEach(button=>{
   button.disabled=false;
   button.title='Resmî ilan doğrulama ve yayınlama formunu aç';
   button.setAttribute('aria-label','İlanı doğrula ve yayınla');
   button.setAttribute('data-yv-publish-fixed','true');
 });
}
const observer=new MutationObserver(updateButtons);
observer.observe(document.body,{childList:true,subtree:true});
updateButtons();
async function openForm(record) {
 const dialog=document.createElement('dialog');
 dialog.style.cssText='width:calc(100% - 24px);max-width:600px;padding:22px;border:1px solid #b9c9cd;border-radius:14px;background:#fff;color:#19343e';
 dialog.innerHTML='<form><h3>Onayla ve Yayınla</h3><p>'+esc(record.title)+'</p><p><a href="'+esc(record.source_url)+'" target="_blank" rel="noopener noreferrer">Resmî kaynağı aç ↗</a></p><label style="display:block;margin:8px 0">Son teklif tarihi ve saati (Türkiye)<input name="expires" type="datetime-local" required style="display:block;width:100%"></label><label style="display:block;margin:8px 0">Özgün açıklama (60–650 karakter)<textarea name="summary" minlength="60" maxlength="650" required rows="5" style="display:block;width:100%"></textarea></label><label style="display:block;margin:8px 0"><input name="verified" type="checkbox" required> Resmî ilanı şimdi kontrol ettim.</label><label style="display:block;margin:8px 0"><input name="equipment" type="checkbox" required> Şartnamede kiralanacak vinç, bom veya iş makinesi kalemini doğruladım.</label><label style="display:block;margin:8px 0"><input name="original" type="checkbox" required> Bu özgün bir özet; kaynak metnini kopyalamadım.</label><p data-message role="alert"></p><button type="submit">Onayla ve Yayınla</button> <button type="button" data-cancel>İptal</button></form>';
 document.body.append(dialog);
 dialog.querySelector('[data-cancel]').addEventListener('click',()=>{dialog.close();dialog.remove()});
 const form=dialog.querySelector('form');
 form.addEventListener('submit',async event=>{
   event.preventDefault();if(!form.reportValidity())return;
   const submit=form.querySelector('[type=submit]'),message=form.querySelector('[data-message]');submit.disabled=true;message.textContent='Denetleniyor…';
   try {
     const data={action:'publish_original_summary',id:record.id,summary:form.elements.summary.value,expires_at:new Date(form.elements.expires.value).toISOString(),verified_now:form.elements.verified.checked,equipment_checked:form.elements.equipment.checked,original_summary_confirmed:form.elements.original.checked};
     const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
     const result=await response.json();
     if(!response.ok)throw Error(result.error||'Yayınlama başarısız.');
     dialog.close();dialog.remove();showMsg('İlan yayımlandı. Güncel listeyi görmek için İş Radarı sekmesini yenile.'); 
   } catch(error){message.textContent=error.message;submit.disabled=false}
 });
 dialog.showModal();
}
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('button[data-publish]');
 if(!button||!document.querySelector('#lr-items')?.contains(button))return;
 event.preventDefault();event.stopImmediatePropagation();
 if(button.disabled)return;
 button.disabled=true;
 try {
  const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Yayınlama verisi yüklenmedi');
  const record=(data.items||[]).find(row=>row.id===button.dataset.publish);
  if(!record)throw Error('Kayıt artık inceleme listesinde yok.');
  if(!eligible(record))throw Error('Yayınlama engeli: Doğrudan resmî .gov.tr veya .bel.tr kaynak bağlantısı ve doğrulanmış kiralama ilanı gerekli. Önce kaynak bilgilerini doğrulayın.');
  await openForm(record);
 }catch(error){showMsg(error.message)}
 finally{button.disabled=false}
},true);
})();
