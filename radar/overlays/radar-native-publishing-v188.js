
function __yvPubEscape(x){
 return String(x==null?'':x).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]});
}
function __yvPubOfficial(url){
 try{
  const u=new URL(String(url||'')),h=u.hostname.toLowerCase();
  return u.protocol==='https:'&&['gov.tr','bel.tr'].some(t=>h===t||h.endsWith('.'+t))&&u.pathname.length>4&&!u.username&&!u.password;
 }catch{return false}
}
function __yvPubDefaultDate(row){
 if(row.draft_expires_at&&Number(row.draft_expires_at)>Date.now()/1000){
  return new Date((Number(row.draft_expires_at)+3*3600)*1000).toISOString().slice(0,16);
 }
 const keys={'manual-adana-2026-1913068':'2026-11-06T11:00','manual-silivri-2026-1931564':'2026-11-11T10:30','manual-kayseri-2026-1807235':'2026-11-05T10:00','manual-ekap-2026-1875854':'2026-11-02T14:00'};
 return keys[row.id]||'';
}
async function __yvNativePublicationPage(request,env,feedback){
 const auth=await requireAdmin({request,env});if(auth.response)return auth.response;
 const rows=await env.DB.prepare("SELECT l.id,l.organization,l.title,l.city,l.district,l.service_type,l.source_url,l.classification,l.verification,l.status,l.public_at,l.public_expires_at,d.expires_at draft_expires_at FROM lead_radar_leads l LEFT JOIN lead_radar_ai_drafts d ON d.lead_id=l.id WHERE l.status IN ('review','approved') ORDER BY CASE WHEN l.public_at IS NULL THEN 0 ELSE 1 END,l.created_at DESC LIMIT 100").all();
 const pending=(rows.results||[]).filter(x=>!x.public_at);
 const live=(rows.results||[]).filter(x=>x.public_at);
 let content='';
 const now=Date.now();
 for(const x of pending){
  const isOfficial=__yvPubOfficial(x.source_url),date=__yvPubDefaultDate(x);
  const expired=date&&Date.parse(date+':00+03:00')<=now;
  const summary=(String(x.organization||'İlgili kurum')+' tarafından '+String(x.city||'Türkiye')+' bölgesinde '+String(x.service_type||x.title)+' kapsamında kiralama hizmeti için teklif alınmaktadır. Şartlar ve başvuru bilgileri resmî ilanda yer almaktadır.').slice(0,550);
  const link=/^https:\/\//i.test(String(x.source_url||''))?'<a href="'+__yvPubEscape(x.source_url)+'" target="_blank" rel="noopener noreferrer">Mevcut kaynak ↗</a>':'';
  content+='<article id="lead-'+__yvPubEscape(x.id)+'" class="yv-row">'+
   '<div class="yv-identity"><h2>'+__yvPubEscape(x.title)+'</h2><span class="yv-wait">Bekliyor</span></div>'+
   '<p>'+__yvPubEscape([x.organization,x.city,x.district].filter(Boolean).join(' · '))+'</p>'+
   '<p>'+link+' <span class="yv-source">'+(isOfficial?'Resmî kaynak kayıtlı':'Asıl resmî bağlantı gerekli')+'</span></p>'+
   '<form action="/admin/radar/yayinla/" method="post">'+
   '<input type="hidden" name="action" value="publish"><input type="hidden" name="id" value="'+__yvPubEscape(x.id)+'">'+
   '<label>Asıl resmî ilan bağlantısı (.gov.tr / .bel.tr)<input name="official_url" type="url" required maxlength="900" value="'+__yvPubEscape(isOfficial?x.source_url:'')+'" placeholder="https://...bel.tr/..."></label>'+
   '<label>Son teklif / başvuru tarihi (Türkiye saati)<input type="datetime-local" name="expires" required value="'+__yvPubEscape(date)+'"></label>'+
   (expired?'<p class="yv-warning">Bu kaydın bilinen tarihi geçti. Kurumdan güncel son tarihi doğrulamadan yayınlanamaz.</p>':'')+
   '<label>Yayımlanacak özgün açıklama (60–650 karakter)<textarea name="summary" minlength="60" maxlength="650" required rows="4">'+__yvPubEscape(summary)+'</textarea></label>'+
   '<label class="yv-check"><input type="checkbox" name="verified" value="yes" required> Resmî duyuruyu açtım, ilanı ve son tarihi doğruladım.</label>'+
   '<label class="yv-check"><input type="checkbox" name="equipment" value="yes" required> Şartnamede gerçekten vinç, sepetli platform veya iş makinesi kiralama talebi bulunuyor.</label>'+
   '<label class="yv-check"><input type="checkbox" name="original" value="yes" required> Açıklamayı kendim yazdım; kaynaktaki telifli metni kopyalamadım.</label>'+
   '<button type="submit">Onayla ve Yayınla</button></form></article>';
 }
 const published=live.length?'<details><summary>Yayındaki kayıtlar ('+live.length+')</summary>'+live.map(x=>'<article class="yv-row"><strong>'+__yvPubEscape(x.title)+'</strong> <span class="yv-ok">Yayında</span></article>').join('')+'</details>':'';
 const note=feedback?'<p role="alert" class="'+(feedback.ok?'yv-good':'yv-error')+'">'+__yvPubEscape(feedback.message)+'</p>':'';
 const html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Radar İlan Yayınlama | YükVinç</title><style>'+
 '*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#f3f7f8;color:#18333d;font-family:system-ui,Arial,sans-serif;line-height:1.5}main{max-width:930px;margin:auto;padding:20px}header{background:#19343e;padding:16px;color:#fff}header a{color:white;margin-right:20px}h1{font-size:1.65rem;margin-bottom:4px}h2{font-size:1.06rem;line-height:1.4;margin:0}.yv-intro{color:#566e78}.yv-row{background:white;border:1px solid #dbe5e8;border-radius:14px;margin:14px 0;padding:20px}.yv-identity{display:flex;justify-content:space-between;gap:12px;align-items:start}.yv-wait,.yv-ok,.yv-source{border-radius:14px;background:#fff1d8;color:#755018;padding:3px 8px;font-size:.78rem;white-space:nowrap}.yv-ok{background:#d9f2e8;color:#135438}.yv-row p{margin:8px 0;color:#506570}label{display:block;font-size:.91rem;font-weight:650;margin:12px 0}input[type=url],input[type=datetime-local],textarea{display:block;width:100%;max-width:100%;font:inherit;border:1px solid #a6bac2;border-radius:8px;padding:9px;margin-top:4px;min-height:42px}textarea{resize:vertical}.yv-check{font-weight:450;display:flex;align-items:start;gap:8px}.yv-check input{margin-top:5px;flex:0 0 auto}button{font:inherit;cursor:pointer;background:#145a70;color:white;border:0;border-radius:10px;padding:12px 22px;font-weight:700}button:hover{background:#0b485c}a{color:#075a78} .yv-error,.yv-good,.yv-warning{padding:10px;border-radius:8px}.yv-error,.yv-warning{color:#a13b20!important;background:#fff2ed}.yv-good{background:#e0f6e9;color:#165c37}summary{cursor:pointer;font-weight:700}@media(max-width:600px){.yv-identity{align-items:start;flex-direction:column}main{padding:14px}}'+
 '</style></head><body><header><a href="/admin/">← Yönetim paneli</a><a href="/admin/radar/">İş Radarı</a></header><main><h1>İş Radarı — Onayla ve Yayınla</h1><p class="yv-intro">Geçerli ilan için resmî bağlantıyı, son tarihi ve özgün açıklamayı kontrol et. **Bir kez** Onayla ve Yayınla düğmesine basınca ilan kaydedilir ve İş Talepleri sayfasına çıkar. Üçüncü taraf duyurularının asıl resmî adresini girmen gerekir.</p>'+note+'<p><strong>'+pending.length+'</strong> incelemede · <strong>'+live.length+'</strong> yayında</p>'+ (content||'<p>Yayın bekleyen ilan yok.</p>')+published+'<p><a href="/is-talepleri/">Yayındaki iş taleplerini görüntüle ↗</a></p></main></body></html>';
 return secure(new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','vary':'Cookie'}}),request,false);
}
async function __yvNativePublicationPost(request,env){
 const admin=await requireAdmin({request,env});if(admin.response)return admin.response;
 const msg=(message,ok=false)=>__yvNativePublicationPage(request,env,{message,ok});
 const origin=request.headers.get('origin');
 const expected=new URL(request.url).origin;
 if(!origin||origin!==expected)return msg('Güvenlik kontrolü: yalnızca site üzerindeki formdan yayınlayabilirsin.');
 const length=Number(request.headers.get('content-length')||0);
 if(length>12000)return msg('Form boyutu sınırı aşıldı.');
 let data;
 try{data=await request.formData()}catch{return msg('Form bilgileri okunamadı.')}
 const id=String(data.get('id')||''),raw=String(data.get('official_url')||'').trim(),summary=String(data.get('summary')||'').trim(),deadline=String(data.get('expires')||'').trim();
 if(data.get('action')!=='publish'||!/^[A-Za-z0-9_-]{8,80}$/.test(id))return msg('İşlem veya ilan kimliği geçersiz.');
 if(data.get('verified')!=='yes'||data.get('equipment')!=='yes'||data.get('original')!=='yes')return msg('Resmî ilan, makine kalemi ve özgün açıklama onayları zorunlu.');
 if(!__yvPubOfficial(raw))return msg('Doğrudan resmî .gov.tr veya .bel.tr ihale bağlantısı girmelisin.');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline))return msg('Son başvuru tarihini doğru biçimde gir.');
 const expiry=Date.parse(deadline+':00+03:00')/1000,now=Math.floor(Date.now()/1000);
 if(!Number.isFinite(expiry)||expiry<=now+60||expiry>now+90*86400)return msg('Son teklif tarihi geçmiş veya 90 günden uzak. Güncel tarihi kontrol et.');
 if(summary.length<60||summary.length>650||/<[^>]*>|https?:\/\/|@/.test(summary)||hasPublicContact(summary))return msg('60-650 karakter arasında, bağlantı ve iletişim bilgisi içermeyen özgün açıklama yaz.');
 const row=await env.DB.prepare("SELECT id,title,service_type,status,public_at,classification,source_url,organization,city FROM lead_radar_leads WHERE id=?").bind(id).first();
 if(!row)return msg('İlan bulunamadı.');
 if(row.public_at)return msg('Bu ilan zaten yayında.',true);
 if(!['review','approved'].includes(row.status))return msg('Bu ilan artık yayınlanabilir durumda değil.');
 if(!rentalContentAllowed({...row,source_excerpt:summary,public_summary:summary,source_url:raw}))return msg('Açıklamada vinç, platform veya iş makinesi kiralama talebi açık değil.');
 try {
  const updated=await env.DB.prepare("UPDATE lead_radar_leads SET status='approved',classification='relevant',verification='manual_reviewed',source_url=?,source_id=CASE WHEN source_url=? THEN source_id ELSE NULL END,public_summary=?,public_at=unixepoch(),public_expires_at=?,verified_at=unixepoch(),publication_method='manual',updated_at=unixepoch() WHERE id=? AND status IN ('review','approved') AND public_at IS NULL").bind(raw,raw,summary,Math.floor(expiry),id).run();
  if(!updated.meta?.changes)return msg('İlan durumu değişti. Sayfayı yenileyip tekrar kontrol et.');
  const verified=await env.DB.prepare("SELECT status,public_at,public_expires_at FROM lead_radar_leads WHERE id=?").bind(id).first();
  if(verified?.status!=='approved'||!verified.public_at||Number(verified.public_expires_at)<=now)return msg('Yayınlama sonrası doğrulama başarısız; yönetici kontrolü gerekli.');
  try{await audit(env,admin.admin.id,'radar.admin.manual_summary_publish','lead_radar_leads',id,{source_url:raw,expires_at:expiry})}catch(e){console.error('[radar-publish-audit]',e?.name||'Error')}
  return msg('YAYINLANDI: '+row.title+' · İş Talepleri sayfasında görünmesi için durum kaydedildi.',true);
 }catch(e){
  if(/UNIQUE constraint/.test(String(e)))return msg('Bu resmî bağlantı başka bir ilanda kayıtlı. Yinelenen kayıtları kontrol et.');
  console.error('[radar-publish]',e?.name||'Error');
  return msg('Yayınlama veritabanına kaydedilemedi. '+String(e?.message||'').slice(0,120));
 }
}
var __yvNativePublishPrev=__yvWorkerV187;
var __yvNativePublishWorker={...__yvNativePublishPrev,async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 const newPage=path==='/admin/radar/yayinla/'||path==='/admin/radar/yayinla';
 if(newPage){
  if(request.method==='GET')return __yvNativePublicationPage(request,env);
  if(request.method==='POST')return __yvNativePublicationPost(request,env);
  return new Response('Method Not Allowed',{status:405,headers:{allow:'GET, POST'}});
 }
 const response=await __yvNativePublishPrev.fetch(request,env,ctx);
 if(['GET','HEAD'].includes(request.method)&&response.status===200&&(path==='/admin/'||path==='/admin'||path==='/admin/radar/'||path==='/admin/radar')&&/text\/html/i.test(response.headers.get('content-type')||'')){
  const notice='<div style="background:#f7ac36;color:#16343e;padding:12px 18px;text-align:center;font:700 15px system-ui,sans-serif"><a href="/admin/radar/yayinla/" style="color:#16343e;text-decoration:underline">YAYIN BEKLEYEN RADAR İLANLARI — ONAYLA VE YAYINLA ↗</a></div>';
  return new HTMLRewriter().on('body',{element(el){el.prepend(notice,{html:true})}}).transform(response);
 }
 return response;
}};
export {__yvNativePublishWorker as default};
