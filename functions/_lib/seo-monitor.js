import {isolatedDb} from './isolated-db.js';
const BASE='https://yukvinc.com.tr',MAX_PAGES=20,MAX_LINKS=8;
const decode=s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const attr=(tag,key)=>decode(tag.match(new RegExp('\\b'+key+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]||'');
export function safeSeoPath(value){try{const u=new URL(decode(value),BASE);if(u.origin!==BASE||u.search||u.hash)return null;return /^\/(?:$|(?:kategori|sehir)\/[^/]+\/|ilan\/[^/]+\/[^/]+\/|sitemaps\/(?:pages|categories|cities|listings|jobs)-[1-9]\d*\.xml$|(?:robots\.txt|sitemap\.xml)$|(?:iletisim|hakkimizda|is-talepleri)\/)$/.test(u.pathname)?u.pathname:null;}catch{return null;}}
export async function boundedSeoText(response){
 const reader=response.body?.getReader();if(!reader)return '';const decoder=new TextDecoder();let bytes=0,text='';
 try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1048576){await reader.cancel();throw Error('response_limit');}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}
}
export function inspectSeoPage(path,response,html){
 const issues=[],type=response.headers.get('content-type')||'';
 if(response.status!==200)issues.push('HTTP '+response.status+' yanıtı');
 if(!type.includes('text/html'))issues.push('HTML içerik türü yok');
 const title=decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').trim();
 const metas=html.match(/<meta\b[^>]*>/gi)||[],links=html.match(/<link\b[^>]*>/gi)||[];
 const description=attr(metas.find(t=>attr(t,'name').toLowerCase()==='description')||'','content');
 const canonical=attr(links.find(t=>attr(t,'rel').toLowerCase()==='canonical')||'','href');
 const robots=attr(metas.find(t=>attr(t,'name').toLowerCase()==='robots')||'','content')+' '+(response.headers.get('x-robots-tag')||'');
 if(!title)issues.push('Başlık eksik');else if(title.length>60)issues.push('Başlık 60 karakterden uzun');
 if(!description)issues.push('Açıklama eksik');else if(description.length>155)issues.push('Açıklama 155 karakterden uzun');
 if(canonical!==BASE+path)issues.push('Canonical adresi sayfa adresiyle eşleşmiyor');
 if(/\bnoindex\b/i.test(robots))issues.push('Dizine ekleme kapalı (noindex); bilinçli olup olmadığını kontrol edin');
 if((html.match(/<h1\b/gi)||[]).length!==1)issues.push('Tek H1 başlığı bulunmuyor');
 const schemas=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
 if(!schemas.length)issues.push('JSON-LD bulunamadı');else for(const match of schemas)try{JSON.parse(match[1]);}catch{issues.push('JSON-LD biçimi geçersiz');break;}
 return{path,status:response.status,title,issues,ok:issues.length===0};
}
export async function seoMonitorStatus(env){const db=await isolatedDb(env);const row=await db.prepare('SELECT * FROM seo_monitor WHERE id=1').first();if(!row)throw Error('monitor_schema');return{enabled:!!row.enabled,running:row.lease_until>Math.floor(Date.now()/1000),report:JSON.parse(row.report_json),next_schedule:'Her gün 09:00 (Türkiye saati)'};}
export async function runSeoMonitor(env,renderPublic,{scheduled=false}={}){
 const db=await isolatedDb(env),time=Math.floor(Date.now()/1000);
 const claim=await db.prepare('UPDATE seo_monitor SET lease_until=?,last_started=? WHERE id=1 AND lease_until<=? AND last_started<=?'+(scheduled?' AND enabled=1':'')).bind(time+120,time,time,time-60).run();
 if(!claim.meta?.changes)return{started:false};
 const report={started_at:time,completed_at:null,pages:[],broken_links:[],checks:[],sampled:false,scope:'Sunucu HTML ve site içi bağlantı denetimi; Search Console indeks durumu veya sıralama ölçümü değildir.'};
 try{
  const deadline=Date.now()+22000;
  const read=async path=>{if(Date.now()>deadline)throw Error('audit_deadline');const response=await renderPublic(path);return{response,text:await boundedSeoText(response)};};
  const robots=await read('/robots.txt');report.checks.push({name:'robots.txt',ok:robots.response.status===200&&/text\/plain/i.test(robots.response.headers.get('content-type')||'')&&/^Sitemap:\s*https:\/\/yukvinc\.com\.tr\/sitemap\.xml\s*$/im.test(robots.text)&&!/^Disallow:\s*\/\s*$/im.test(robots.text)});
  const index=await read('/sitemap.xml');report.checks.push({name:'sitemap.xml',ok:index.response.status===200&&/xml/i.test(index.response.headers.get('content-type')||'')&&/<(?:sitemapindex|urlset)\b/.test(index.text)});
  const locs=text=>[...text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(m=>safeSeoPath(m[1])).filter(Boolean);
  let discovered=locs(index.text);
  if(/<sitemapindex\b/.test(index.text)){
   const childPaths=discovered.filter(p=>p.startsWith('/sitemaps/'));discovered=[];
   if(childPaths.length>6)report.sampled=true;
   for(const child of childPaths.slice(0,6)){const r=await read(child);report.checks.push({name:child,ok:r.response.status===200&&/<urlset\b/.test(r.text)});discovered.push(...locs(r.text));}
  }
  const ordered=[...new Set(['/',...discovered.filter(p=>p.startsWith('/ilan/')),...discovered.filter(p=>!p.startsWith('/ilan/'))])].filter(p=>!p.endsWith('.xml')&&!p.endsWith('.txt'));
  if(ordered.length>MAX_PAGES)report.sampled=true;
  const selected=ordered.slice(0,MAX_PAGES),anchors=new Set(),seen=new Set();
  for(const path of selected){const {response,text}=await read(path);seen.add(path);report.pages.push(inspectSeoPage(path,response,text));for(const match of text.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)){const link=safeSeoPath(match[1]);if(link&&!link.endsWith('.xml')&&!link.endsWith('.txt'))anchors.add(link);}}
  const extra=[...anchors].filter(p=>!seen.has(p));if(extra.length>MAX_LINKS)report.sampled=true;
  for(const path of extra.slice(0,MAX_LINKS)){if(Date.now()>deadline)throw Error('audit_deadline');const r=await renderPublic(path);await r.body?.cancel();if(r.status>=400||r.status===300)report.broken_links.push({path,status:r.status});}
  const titles=new Map();for(const page of report.pages){if(!page.title)continue;if(titles.has(page.title)){page.issues.push('Başka sayfayla aynı başlık: '+titles.get(page.title));page.ok=false;}else titles.set(page.title,page.path);}
  report.completed_at=Math.floor(Date.now()/1000);
 }catch(error){report.error='Denetim tamamlanamadı. Sonuçlar kısmi olabilir.';console.error('[seo-monitor]',JSON.stringify({event:'audit_failed',name:error?.name||'Error'}));}
 await db.prepare('UPDATE seo_monitor SET report_json=?,lease_until=0 WHERE id=1 AND last_started=?').bind(JSON.stringify(report),time).run();
 return{started:true,report};
}
