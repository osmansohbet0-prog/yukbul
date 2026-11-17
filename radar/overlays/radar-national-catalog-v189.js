
function __yvCatalogEscape(x) {
 return String(x==null?'':x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
async function __yvCatalogPage(request,env) {
 const auth=await requireAdmin({request,env});if(auth.response)return auth.response;
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405,headers:{allow:'GET,HEAD'}});
 const url=new URL(request.url),q=String(url.searchParams.get('q')||'').trim().slice(0,80),type=String(url.searchParams.get('type')||'all'),pg=Math.min(1000,Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1));
 const provinceNum=Number(url.searchParams.get('province')||0);
 const province=Number.isInteger(provinceNum)&&provinceNum>=1&&provinceNum<=81?provinceNum:0;
 const clauses=['1=1'],args=[];
 if(q){clauses.push("(name LIKE ? OR feed_url LIKE ?)");args.push('%'+q+'%','%'+q+'%')}
 if(type==='municipal'){clauses.push("source_category='municipal_directory'")}
 else if(type==='osb'){clauses.push("source_category='osb_directory'")}
 else if(type==='active'){clauses.push('enabled=1')}
 else if(type==='existing'){clauses.push("source_category NOT IN ('municipal_directory','osb_directory')")}
 if(province){clauses.push("EXISTS(SELECT 1 FROM json_each(lead_radar_sources.province_codes_json) WHERE CAST(json_each.value AS INTEGER)=?)");args.push(province)}
 const where=' WHERE '+clauses.join(' AND ');
 const count=await env.DB.prepare('SELECT COUNT(*) n FROM lead_radar_sources'+where).bind(...args).first();
 const total=Number(count?.n||0),perPage=50,page=Math.max(1,Math.min(Math.ceil(total/perPage)||1,pg)),offset=(page-1)*perPage;
 const [rows,prov,allStats]=await Promise.all([
  env.DB.prepare('SELECT id,name,feed_url,enabled,source_category,last_scan_status,permission_status,province_codes_json FROM lead_radar_sources'+where+' ORDER BY enabled DESC,CASE source_category WHEN \'municipal_directory\' THEN 2 WHEN \'osb_directory\' THEN 3 ELSE 1 END,name ASC LIMIT ? OFFSET ?').bind(...args,perPage,offset).all(),
  env.DB.prepare('SELECT province_code,province_name FROM lead_radar_provinces ORDER BY province_code').all(),
  env.DB.prepare("SELECT COUNT(*) all_total,COALESCE(SUM(enabled),0) auto_active,COALESCE(SUM(source_category='municipal_directory'),0) municipality_total,COALESCE(SUM(source_category='osb_directory'),0) osb_total FROM lead_radar_sources").first()
 ]);
 const E=__yvCatalogEscape;
 const linkFor=x=>{try{const u=new URL(x);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}};
 const params=new URLSearchParams();if(q)params.set('q',q);if(type!=='all')params.set('type',type);if(province)params.set('province',String(province));
 const pageLink=n=>{const p=new URLSearchParams(params);p.set('page',String(n));return '/admin/radar/kaynaklar/?'+p.toString()};
 const cards=(rows.results||[]).map(r=>{
 const href=linkFor(r.feed_url),newCatalog=['municipal_directory','osb_directory'].includes(r.source_category);
 const info=newCatalog?'Kurum dizini · ihale kaynağı doğrulanmadı':r.source_category==='public_tender'?'İhale kaynağı':'Önceki Radar kaynağı';
 const active=Number(r.enabled)===1;
 return '<article class="source"><div class="headline"><strong>'+E(r.name)+'</strong><span class="'+(active?'active':'manual')+'">'+(active?'Otomatik aktif':'Manuel / pasif')+'</span></div><p>'+E(info)+'</p>'+
 (href?'<p><a target="_blank" rel="noopener noreferrer nofollow" href="'+E(href)+'">Kurum web sitesini aç ↗</a></p>':'')+
 '<small>'+E(String(r.last_scan_status||'').slice(0,180))+'</small></article>'
 }).join('')||'<p>Bu filtrede kaynak bulunmadı.</p>';
 const provinceOptions='<option value="">81 il — tümü</option>'+(prov.results||[]).map(v=>'<option value="'+v.province_code+'"'+(v.province_code===province?' selected':'')+'>'+E(v.province_name)+'</option>').join('');
 const typeOptions=[['all','Tüm kaynaklar'],['active','Otomatik aktif'],['municipal','Belediye kurumları'],['osb','Organize sanayi bölgeleri'],['existing','Diğer / önceki kaynaklar']].map(([v,n])=>'<option value="'+v+'"'+(v===type?' selected':'')+'>'+n+'</option>').join('');
 const paging='<nav class="pages">'+(page>1?'<a href="'+E(pageLink(page-1))+'">← Önceki 50</a>':'')+'<span>Sayfa '+page+' / '+Math.max(1,Math.ceil(total/perPage))+'</span>'+(offset+perPage<total?'<a href="'+E(pageLink(page+1))+'">Sonraki 50 →</a>':'')+'</nav>';
 const html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Radar Kaynak Kataloğu | YükVinç</title><style>'+
 '*{box-sizing:border-box}body{font:15px system-ui,Arial,sans-serif;margin:0;background:#f4f7f8;color:#16333d;line-height:1.5}header{padding:16px;background:#16343f;color:white}header a{color:white;margin-right:18px}main{max-width:1000px;margin:auto;padding:20px}h1{font-size:1.7rem;margin:18px 0 8px}.stats{display:flex;gap:12px;flex-wrap:wrap}.stat{flex:1 1 145px;background:#fff;border:1px solid #dce5e8;border-radius:12px;padding:15px}.stat strong{display:block;font-size:1.6rem}.stat span,small{font-size:.78rem;color:#5e727b}.filters{display:flex;flex-wrap:wrap;gap:10px;background:white;border:1px solid #dce5e8;border-radius:12px;padding:14px;margin:18px 0;align-items:end}.filters label{display:grid;gap:4px;flex:1 1 170px;color:#465f6a}.filters input,.filters select{width:100%;font:inherit;padding:9px;border:1px solid #abc0c6;border-radius:8px}.filters button{border:0;padding:10px 20px;background:#145a70;color:white;border-radius:8px;cursor:pointer}.source{background:#fff;padding:14px 18px;border:1px solid #dbe6e8;border-radius:12px;margin:9px 0}.headline{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.source p{color:#4a6571;margin:5px 0}.source a{color:#075c7d}.active,.manual{font-size:.75rem;border-radius:20px;padding:3px 9px;background:#e0f1e8;color:#235d40}.manual{background:#eef2f3;color:#4e6a76}.pages{display:flex;gap:20px;align-items:center;justify-content:center;padding:18px;flex-wrap:wrap}.pages a{color:#075c7d;font-weight:700}.disclaimer{background:#fff9ee;padding:12px 16px;border-left:3px solid #e4a64a;margin:16px 0;color:#674c24}a:focus,button:focus,input:focus,select:focus{outline:2px solid #e5a34b;outline-offset:2px}@media(max-width:620px){main{padding:12px}.stats{gap:8px}.stat{padding:10px}}'+
 '</style></head><body><header><a href="/admin/">← Admin</a><a href="/admin/radar/">İş Radarı</a><a href="/admin/radar/yayinla/">Yayınlama</a></header><main><h1>Türkiye Geneli Radar Kaynak Kataloğu</h1><div class="stats">'+
 '<div class="stat"><span>Toplam kayıt</span><strong>'+allStats.all_total+'</strong></div><div class="stat"><span>Otomatik aktif</span><strong>'+allStats.auto_active+'</strong></div><div class="stat"><span>Belediye kurum rehberi</span><strong>'+allStats.municipality_total+'</strong></div><div class="stat"><span>OSB kurum rehberi</span><strong>'+allStats.osb_total+'</strong></div></div>'+
 '<p class="disclaimer">Kurum rehberindeki bağlantılar, otomatik taranan ihale kanalı veya güncel vinç talebi anlamına gelmez. İhale sayfası ve erişim/yeniden yayın izni doğrulanana kadar bu kayıtlar pasiftir.</p>'+
 '<form method="get" action="/admin/radar/kaynaklar/" class="filters"><label>Kaynak ara<input name="q" maxlength="80" value="'+E(q)+'" placeholder="Gebze, Ankara, OSB..."></label><label>Kaynak grubu<select name="type">'+typeOptions+'</select></label><label>İl<select name="province">'+provinceOptions+'</select></label><button type="submit">Filtrele</button></form>'+
 '<p><strong>'+total+'</strong> eşleşen kurum kaydı · '+(total?offset+1:0)+'–'+Math.min(total,offset+perPage)+' gösteriliyor.</p>'+paging+cards+paging+'</main></body></html>';
 return secure(new Response(request.method==='HEAD'?null:html,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','vary':'Cookie'}}),request);
}
var __yvCatalogPrevWorker=__yvNativePublishWorker;
var __yvCatalogWorker={...__yvCatalogPrevWorker,async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(path==='/admin/radar/kaynaklar/'||path==='/admin/radar/kaynaklar'){
  try{return await __yvCatalogPage(request,env)}catch(e){console.error('[radar-catalog]',e?.name||'Error');return new Response('Kaynak kataloğu şu anda görüntülenemiyor.',{status:503})}
 }
 const old=await __yvCatalogPrevWorker.fetch(request,env,ctx);
 if((path==='/admin/radar/'||path==='/admin/radar'||path==='/admin/'||path==='/admin')&&request.method==='GET'&&old.status===200&&/text\/html/i.test(old.headers.get('content-type')||'')){
  return new HTMLRewriter().on('body',{element(el){el.prepend('<div style="padding:10px;background:#e1edf1;color:#173d50;font:600 14px system-ui;text-align:center"><a href="/admin/radar/kaynaklar/" style="color:#075a75;text-decoration:underline">Tüm Radar kaynaklarını görüntüle — Türkiye geneli kurum kataloğu ↗</a></div>',{html:true})}}).transform(old);
 }
 return old;
}};
export {__yvCatalogWorker as default};
