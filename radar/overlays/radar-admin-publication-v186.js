
async function __yvNoticeApi(request, env) {
 const a=await requireAdmin({request,env});if(a.response)return a.response;
 const json3=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
 if(request.method==='GET'){
   try{const x=await env.DB.prepare("SELECT id,title,organization,city,status,classification,verification,source_url,public_at FROM lead_radar_leads WHERE status IN ('review','approved') ORDER BY CASE WHEN public_at IS NULL THEN 0 ELSE 1 END,created_at DESC LIMIT 75").all();return json3({items:x.results||[]})}
   catch{return json3({error:'İlan listesi yüklenemedi.'},503)}
 }
 if(request.method!=='POST')return json3({error:'Yöntem desteklenmiyor.'},405);
 if(!isAllowedOrigin(request))return json3({error:'İstek kaynağı uygun değil.'},403);
 try{
  const d=await readJson(request,6000),id=String(d.id||''),summary=String(d.summary||'').trim(),expires=Date.parse(String(d.expires_at||''))/1000,now=Math.floor(Date.now()/1000);
  if(d.action!=='publish_original_summary'||!/^[A-Za-z0-9_-]{8,80}$/.test(id))return json3({error:'İşlem geçersiz.'},400);
  if(d.verified_now!==true||d.equipment_checked!==true||d.original_summary_confirmed!==true)return json3({error:'Üç doğrulama kutusunu işaretleyin.'},400);
  if(summary.length<60||summary.length>650||/https?:\/\/|<[^>]*>|@/.test(summary)||hasPublicContact(summary))return json3({error:'60-650 karakterlik özgün açıklama yazın; iletişim bilgisi veya bağlantı eklemeyin.'},400);
  if(!Number.isFinite(expires)||expires<=now+300||expires>now+90*86400)return json3({error:'Son teklif tarihi gelecekte ve en fazla 90 gün içinde olmalı.'},400);
  const row=await env.DB.prepare("SELECT id,title,status,classification,verification,source_url,service_type,public_at FROM lead_radar_leads WHERE id=?").bind(id).first();
  if(!row)return json3({error:'Kayıt bulunamadı.'},404);
  if(row.public_at)return json3({error:'Bu kayıt zaten yayında.'},409);
  if(!['review','approved'].includes(row.status)||!['uncertain','relevant'].includes(row.classification)||!['official_source','manual_reviewed'].includes(row.verification))return json3({error:'Önce resmî kaynak doğrulaması gerekiyor.'},409);
  let u;try{u=new URL(row.source_url)}catch{}
  if(!u||u.protocol!=='https:'||!/(^|\.)gov\.tr$|(^|\.)bel\.tr$/.test(u.hostname.toLowerCase()))return json3({error:'Resmî .gov.tr veya .bel.tr duyuru bağlantısı gerekli. Üçüncü taraf kaynakla yayımlanamaz.'},409);
  if(!rentalContentAllowed({...row,public_summary:summary,source_excerpt:summary+' '+row.service_type}))return json3({error:'Açıklamada gerçek bir makine/vinç kiralama ihtiyacı doğrulanamadı.'},409);
  const updated=await env.DB.prepare("UPDATE lead_radar_leads SET status='approved',classification='relevant',verification='manual_reviewed',public_summary=?,public_at=unixepoch(),public_expires_at=?,verified_at=unixepoch(),publication_method='manual',updated_at=unixepoch() WHERE id=? AND public_at IS NULL AND status IN ('review','approved') AND classification IN ('uncertain','relevant') AND verification IN ('official_source','manual_reviewed')").bind(summary,Math.floor(expires),id).run();
  if(!updated.meta?.changes)return json3({error:'Kayıt değişti, sayfayı yenileyin.'},409);
  try{await audit(env,a.admin.id,'radar.notice.original_summary_publish','lead_radar_leads',id,{official_source:row.source_url,deadline:expires})}catch(e){console.error('[radar-notice-audit]',e?.name||'Error')}
  return json3({ok:true,published:true});
 }catch(e){return json3({error:'Yayın işlemi başarısız: '+String(e?.message||'İstek hatası').slice(0,160)},400)}
}


var __yvNoticeAdminJavascript="(()=>{\n'use strict';\nconst root=document.querySelector('[data-radar-panel=\"opportunities\"]');if(!root)return;\nconst esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nconst holder=document.createElement('section');holder.className='radar-group';holder.innerHTML='<h2>Yayınlama yönetimi</h2><p class=\"radar-hint\">Yalnız resmî ilandan doğruladığınız kiralama ihtiyacının özgün özetini yayımlayın. Üçüncü taraf ve doğrulanmamış kayıtlar engellenir.</p><div id=\"pub-status\" role=\"status\"></div><div id=\"pub-items\" class=\"radar-items\"></div>';root.insertBefore(holder,root.querySelector('.radar-group:last-child'));\nconst status=holder.querySelector('#pub-status'),items=holder.querySelector('#pub-items');let records=[];\nconst eligible=x=>{try{return /(^|\\.)gov\\.tr$|(^|\\.)bel\\.tr$/.test(new URL(x.source_url).hostname)&&['official_source','manual_reviewed'].includes(x.verification)&&['review','approved'].includes(x.status)&&['relevant','uncertain'].includes(x.classification)}catch{return false}};\nasync function refresh(){try{const r=await fetch('/api/admin-radar-publish',{credentials:'same-origin',cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);records=d.items;const pending=records.filter(x=>!x.public_at);status.textContent=pending.length+' aday yayın incelemesinde';items.innerHTML=pending.length?pending.map(x=>'<article class=\"radar-item\"><strong>'+esc(x.title)+'</strong><p>'+esc(x.city)+' · '+(eligible(x)?'Resmî ilan doğrulaması ve son tarih girişi bekleniyor.':'Yayın engelli: Asıl resmî kaynak bağlantısı veya doğrulama eksik.')+'</p><div class=\"radar-item-foot\"><a href=\"'+esc(x.source_url)+'\" target=\"_blank\" rel=\"noopener noreferrer\">Kaynağa git ↗</a>'+(eligible(x)?'<button type=\"button\" data-publish-id=\"'+esc(x.id)+'\">Doğrula ve yayınla</button>':'')+'</div></article>').join(''):'<p class=\"radar-empty\">İncelemede aday yok.</p>'}catch(e){status.textContent=e.message||'Yayın paneli yüklenemedi'}}\nitems.addEventListener('click',e=>{const b=e.target.closest('[data-publish-id]');if(!b)return;const x=records.find(x=>x.id===b.dataset.publishId);if(!x)return;const dlg=document.createElement('dialog');dlg.style.cssText='max-width:560px;width:calc(100% - 24px);border:1px solid #ccd8de;border-radius:14px;padding:20px;background:white;color:#19333e';dlg.innerHTML='<form><h3>Resmî ilanı yayınla</h3><p>'+esc(x.title)+'</p><p><a href=\"'+esc(x.source_url)+'\" target=\"_blank\" rel=\"noopener noreferrer\">Resmî ilanı aç ↗</a></p><label>Son teklif tarihi ve saati (Türkiye)<input name=\"expiry\" type=\"datetime-local\" required></label><label>Özgün özet (60-650 karakter)<textarea name=\"summary\" minlength=\"60\" maxlength=\"650\" rows=\"5\" required style=\"display:block;width:100%\" placeholder=\"İhtiyaç duyulan vinç veya makine, şehir ve süreyi kendi cümlelerinle anlat.\"></textarea></label><p><label><input type=\"checkbox\" name=\"verified\" required> Kaynağı şimdi kontrol ettim.</label></p><p><label><input type=\"checkbox\" name=\"equipment\" required> Şartnamede vinç, bom veya iş makinesi kiralama ihtiyacını doğruladım.</label></p><p><label><input type=\"checkbox\" name=\"original\" required> Özet özgün; kaynak metnini kopyalamadım.</label></p><p id=\"pub-message\" role=\"status\"></p><button type=\"submit\">Onayla ve yayınla</button> <button type=\"button\" data-close>İptal</button></form>';document.body.append(dlg);dlg.querySelector('[data-close]').onclick=()=>{dlg.close();dlg.remove()};dlg.querySelector('form').addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget;if(!form.reportValidity())return;const message=dlg.querySelector('#pub-message'),btn=form.querySelector('[type=submit]');btn.disabled=true;message.textContent='İlan kontrol ediliyor…';try{const d={action:'publish_original_summary',id:x.id,summary:form.elements.summary.value,expires_at:new Date(form.elements.expiry.value).toISOString(),verified_now:form.elements.verified.checked,equipment_checked:form.elements.equipment.checked,original_summary_confirmed:form.elements.original.checked};const response=await fetch('/api/admin-radar-publish',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(d)});const result=await response.json();if(!response.ok)throw Error(result.error||'Yayınlanamadı');message.textContent='Yayınlandı.';dlg.close();dlg.remove();await refresh()}catch(err){message.textContent=err.message;btn.disabled=false}});dlg.showModal()});\nrefresh();\n})();";
var __yvPrevPublicWorker=__yvRadarLive;
var __yvFixedPublishWorker={...__yvPrevPublicWorker,async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(path==='/api/admin-radar-publish')return secure(await __yvNoticeApi(request,env),request,true);
 if(path==='/assets/radar-publish-controls.js'){
   if(!['GET','HEAD'].includes(request.method))return new Response('Method Not Allowed',{status:405});
   const check=await requireAdmin({request,env});if(check.response)return check.response;
   return secure(new Response(request.method==='HEAD'?null:__yvNoticeAdminJavascript,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'private, no-store'}}),request);
 }
 const result=await __yvPrevPublicWorker.fetch(request,env,ctx);
 if((path==='/admin/radar/'||path==='/admin/radar')&&request.method==='GET'&&result.status===200&&/text\/html/i.test(result.headers.get('content-type')||'')){
   return new HTMLRewriter().on('body',{element(el){el.append('<script src="/assets/radar-publish-controls.js" defer></script>',{html:true})}}).transform(result);
 }
 return result;
}};
export {__yvFixedPublishWorker as default};
