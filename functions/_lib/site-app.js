export function withSiteApp(base,assets){
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 const privatePath=p=>/^\/(?:api|admin|yonetim|hesabim|giris|ilan-ver|yonetici-kurulum)(?:\/|$)/.test(p);
 return {...base,async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/site-visit'){
   if(request.method!=='POST')return json({error:'Method not allowed'},405);
   if(request.headers.get('origin')!==url.origin||Number(request.headers.get('content-length')||0)>2048)return json({error:'Invalid request'},403);
   if(/bot|crawler|spider|headless/i.test(request.headers.get('user-agent')||''))return new Response(null,{status:204});
   try{
    const text=await request.text();if(text.length>2048)return json({error:'Too large'},413);const data=JSON.parse(text);
    if(!/^[a-f0-9-]{36}$/i.test(data.session||'')||typeof data.path!=='string'||data.path.length>250||!/^\/(?:$|(?:ilan|kategori|sehir)\/[\p{L}\p{N}_\/-]+\/?$|(?:uygulama|iletisim|hakkimizda|gizlilik)\/?$)/u.test(data.path))return json({error:'Invalid page'},400);
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const hash=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const session=await hash(day+'|'+data.session+'|'+(env.METRICS_HASH_KEY||'')),id=await hash(session+'|'+data.path+'|'+Math.floor(Date.now()/30000));
    await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO site_visits(id,day,session_hash,path) VALUES(?,?,?,?)').bind(id,day,session,data.path),env.DB.prepare('DELETE FROM site_visits WHERE created_at<unixepoch()-2592000')]);return new Response(null,{status:204,headers:{'cache-control':'no-store'}});
   }catch{return json({error:'Visit recording unavailable'},503)}
  }
  if(path==='/api/admin-site-visits'){
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const auth=await base.fetch(new Request(new URL('/api/admin-session',url),{headers:request.headers}),env,ctx);if(!auth.ok)return json({error:'Yönetici girişi gerekli'},401);
   try{
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),start=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-6*86400000));
    const [today,week,top,since]=await Promise.all([env.DB.prepare('SELECT COUNT(*) views,COUNT(DISTINCT session_hash) sessions FROM site_visits WHERE day=?').bind(day).first(),env.DB.prepare('SELECT COUNT(*) views FROM site_visits WHERE day>=?').bind(start).first(),env.DB.prepare('SELECT path,COUNT(*) views FROM site_visits WHERE day>=? GROUP BY path ORDER BY views DESC LIMIT 5').bind(start).all(),env.DB.prepare('SELECT MIN(day) since FROM site_visits').first()]);return json({today,week,top:top.results||[],since:since?.since||day,retention_days:30});
   }catch{return json({error:'Ziyaret verileri alınamadı'},503)}
  }
  if(assets[path]&&['GET','HEAD'].includes(request.method)){
   const [type,body]=assets[path];return new Response(request.method==='HEAD'?null:body,{headers:{'content-type':type,'cache-control':path==='/sw.js'?'no-cache':'public, max-age=300','x-content-type-options':'nosniff',...(path==='/sw.js'?{'service-worker-allowed':'/'}:{})}});
  }
  const response=await base.fetch(request,env,ctx);
  if(request.method==='GET'&&response.status===200&&response.headers.get('content-type')?.includes('text/html')){
   const publicPage=!privatePath(path),admin=/^\/(?:admin|yonetim)(?:\/|$)/.test(path);
   if(!publicPage&&!admin)return response;
   const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');
   let body=await response.text();if(publicPage)body=body.replace('</head>','<link rel="stylesheet" href="/assets/listing-mobile.css?v=20261029b"><link rel="stylesheet" href="/assets/site-simple.css?v=20261029a"></head>');if(publicPage&&!/rel=["']manifest["']/.test(body))body=body.replace('</head>','<link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#172d35"></head>');
   if(publicPage&&path==='/')body=body.replace('</footer>','<p><a href="/uygulama/">YükVinç’i telefonuna yükle</a></p></footer>');
   if(publicPage&&path!=='/')body=body.replace('</body>','<script src="/assets/site-guide.js?v=20261029b" defer></script></body>');
   body=body.replace('</body>','<script src="/assets/mobile-app.js?v=20261029a" defer></script></body>');return new Response(body,{status:response.status,headers});
  }
  return response;
 }};
}
