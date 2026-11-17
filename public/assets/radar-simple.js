const $ = (id) => document.getElementById(id);
let snapshot = null;
let activeView = 'opportunities';

function safeText(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function short(value, max=125) { const s=String(value||''); return s.length>max?s.slice(0,max)+'…':s; }
function safeLink(value) {
  try { const u = new URL(String(value)); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; }
  catch { return ''; }
}
function time(ts) {
  return Number(ts) ? new Date(Number(ts) * 1000).toLocaleString('tr-TR') : 'Bilinmiyor';
}
function tag(text, kind='') {
  return '<span class="radar-chip '+safeText(kind)+'">'+safeText(text)+'</span>';
}
function sourceLink(url) {
  const href = safeLink(url);
  return href ? '<a href="'+safeText(href)+'" target="_blank" rel="noopener noreferrer">Kaynağı aç ↗</a>' : '';
}
function area(city,district) {
  return [city,district].filter(Boolean).join(' / ') || 'Konum belirtilmedi';
}
function leadCard(x) {
  const state = x.status === 'review' ? tag('İnceleme bekliyor','warn') : tag('Onaylı','ok');
  const proof = x.verification === 'official_source' ? 'Resmî kaynak' : x.verification === 'manual_reviewed' ? 'Elle doğrulandı' : 'Doğrulanmadı';
  return '<article class="radar-item"><div class="radar-item-title"><strong>'+safeText(x.title)+'</strong>'+state+'</div>'+
    '<p>'+safeText(area(x.city,x.district))+' · '+safeText(x.organization || 'Kurum belirtilmedi')+'</p>'+
    '<div class="radar-item-meta">'+tag(proof,x.verification==='unverified'?'warn':'')+tag(short(x.service_type || 'Hizmet talebi',90))+'</div>'+
    '<div class="radar-item-foot"><small>Kayıt: '+time(x.created_at)+'</small>'+sourceLink(x.source_url)+'</div></article>';
}
function requestCard(x) {
  const state=x.status==='open'?tag('Açık müşteri talebi','ok'):tag('Onay bekliyor','warn');
  return '<article class="radar-item"><div class="radar-item-title"><strong>'+safeText(x.title)+'</strong>'+state+'</div>'+
    '<p>'+safeText(area(x.city,x.district))+' · '+safeText(x.category)+'</p>'+
    '<div class="radar-item-foot"><small>'+time(x.created_at)+'</small><small>Üye talebi · iletişim verileri bu görünümde gizli</small></div></article>';
}
function sourceCard(x) {
  const paused=Number(x.enabled)!==1;
  const issue=Number(x.consecutive_errors)>0;
  const status=paused?'Pasif':issue?'Hata var':'Aktif';
  const kind=paused?'':issue?'warn':'ok';
  return '<article class="radar-item"><div class="radar-item-title"><strong>'+safeText(x.name)+'</strong>'+tag(status,kind)+'</div>'+
    '<p>'+safeText(x.source_category || x.source_type)+' · '+(Number(x.scan_interval_seconds)>=86400?'24 saat':Math.round(Number(x.scan_interval_seconds)/3600)+' saat')+' aralık</p>'+
    '<small>'+safeText(short(x.last_scan_status||'Henüz taranmadı',155))+'</small></article>';
}
function runCard(x) {
  const issue=x.outcome==='error';
  return '<article class="radar-log"><div><strong>'+safeText(x.source_name||'Kaynak')+'</strong> '+tag(issue?'Hata':'Tamamlandı',issue?'warn':'ok')+'</div>'+
    '<small>'+time(x.started_at)+' · '+Number(x.items_seen||0)+' kayıt · '+Number(x.candidates_added||0)+' yeni aday</small>'+
    (issue?'<p>'+safeText(short(x.error_message||'Nedeni belirtilmemiş',180))+'</p>':'')+'</article>';
}
function renderOpportunities() {
  const q=$('radar-search').value.trim().toLocaleLowerCase('tr');
  const region=$('radar-region').value;
  function match(x) {
    const text=[x.title,x.city,x.district,x.organization,x.service_type,x.category].join(' ').toLocaleLowerCase('tr');
    return (!q||text.includes(q)) && (!region || (region==='kocaeli' ? ['Kocaeli','Sakarya','İstanbul'].includes(x.city) : x.city===region));
  }
  const requests=snapshot.requests.filter(match);
  const leads=snapshot.leads.filter(match);
  $('radar-requests').innerHTML=requests.length?requests.map(requestCard).join(''):'<p class="radar-empty">Bu filtreye uygun açık üye talebi yok.</p>';
  $('radar-leads').innerHTML=leads.length?leads.map(leadCard).join(''):'<p class="radar-empty">Bu filtreye uygun onaylı ya da incelenecek aday yok.</p>';
  $('radar-request-count').textContent=String(requests.length);
  $('radar-lead-count').textContent=String(leads.length);
}
function renderSources(){
  const state=$('radar-source-filter').value;
  const items=snapshot.sources.filter(x=>state==='all'||state==='active'&&Number(x.enabled)===1||state==='problem'&&Number(x.consecutive_errors)>0);
  $('radar-sources').innerHTML=items.length?items.map(sourceCard).join(''):'<p class="radar-empty">Bu grupta kaynak yok.</p>';
}
function selectView(view){
  activeView=view;
  document.querySelectorAll('[data-radar-view]').forEach(el=>{const selected=el.dataset.radarView===view; el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));});
  document.querySelectorAll('[data-radar-panel]').forEach(el=>el.hidden=el.dataset.radarPanel!==view);
}
function updateSummary(){
  const s=snapshot.summary;
  $('radar-stat-open').textContent=s.open_requests;
  $('radar-stat-review').textContent=s.review;
  $('radar-stat-approved').textContent=s.approved;
  $('radar-stat-sources').textContent=s.active_sources;
  $('radar-stat-buyer').textContent=s.verified_buyers;
  $('radar-stat-errors').textContent=s.source_errors;
  $('radar-updated').textContent='Güncellendi: '+time(snapshot.updated_at);
}
async function load(){
  const status=$('radar-status'); status.textContent='Radar yükleniyor…';
  $('radar-refresh').disabled=true;
  try {
    const response=await fetch('/api/admin-radar-dashboard',{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});
    if(response.status===401||response.status===403){status.innerHTML='Yönetici oturumu gerekli. <a href="/admin/">Giriş yap</a>';return;}
    if(!response.ok)throw new Error('HTTP '+response.status);
    snapshot=await response.json();
    updateSummary();renderOpportunities();renderSources();
    $('radar-runs').innerHTML=(snapshot.runs||[]).slice(0,15).map(runCard).join('')||'<p class="radar-empty">Tarama kaydı bulunamadı.</p>';
    status.textContent='';
  }catch{status.textContent='Radar yüklenemedi. Yönetici oturumunu ve bağlantıyı kontrol edin.';}
  finally{$('radar-refresh').disabled=false;}
}
document.querySelectorAll('[data-radar-view]').forEach(button=>button.addEventListener('click',()=>selectView(button.dataset.radarView)));
$('radar-refresh').addEventListener('click',load);
$('radar-search').addEventListener('input',()=>{if(snapshot)renderOpportunities();});
$('radar-region').addEventListener('change',()=>{if(snapshot)renderOpportunities();});
$('radar-source-filter').addEventListener('change',()=>{if(snapshot)renderSources();});
selectView(activeView);
load();
