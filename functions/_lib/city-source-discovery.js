const entities={amp:'&',quot:'"',apos:"'",nbsp:' ',ccedil:'ç',Ccedil:'Ç',uuml:'ü',Uuml:'Ü',ouml:'ö',Ouml:'Ö',scedil:'ş',Scedil:'Ş',gbreve:'ğ',Gbreve:'Ğ',Idot:'İ',inodot:'ı'};
export const plainSourceText=s=>String(s||'').replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(raw,key)=>{if(key.startsWith('#')){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return Number.isInteger(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';}return entities[key]??raw;}).replace(/\s+/g,' ').trim();
const plain=plainSourceText;
const fold=s=>plain(s).toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function officialUrl(value,base){
 try{const u=new URL(value,base);if(u.protocol!=='https:'||u.username||u.password||u.port||!/(?:\.bel\.tr|\.gov\.tr)$/.test(u.hostname))return null;u.hash='';return u.toString();}catch{return null;}
}
export function parseMunicipalityDirectory(html){
 const result=[];
 for(const block of String(html).split(/<div class="accordion-item views-row">/).slice(1)){
  const code=Number(block.match(/data-code="(\d+)"/)?.[1]);
  const city=plain(block.match(/field--name-name[^>]*>([\s\S]*?)<\/div>/)?.[1]);
  if(!code||code>81||!city)continue;
  const links=[...block.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*class="[^"]*list-group-item[^" ]*[^"]*"[^>]*>([\s\S]*?)<\/a>/g)];
  if(!links.length)continue;
  result.push({code,city,name:plain(links[0][2]),homepage:officialUrl(links[0][1]),listed_url:links[0][1],directory_url:'https://www.tbb.gov.tr/tr/buyuksehir-ve-il-belediyeleri'});
 }
 return result;
}
export function parseAllMunicipalities(html){
 const result=[];
 for(const block of String(html).split(/<div class="accordion-item views-row">/).slice(1)){
  const code=Number(block.match(/data-code="(\d+)"/)?.[1]),city=plain(block.match(/field--name-name[^>]*>([\s\S]*?)<\/div>/)?.[1]);
  if(!code||code>81||!city)continue;
  for(const m of block.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*class="[^"]*list-group-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g)){
   const homepage=officialUrl(m[1]);if(!homepage||result.some(x=>x.homepage===homepage))continue;
   result.push({code,city,name:plain(m[2]),homepage,directory_url:'https://www.tbb.gov.tr/tr/buyuksehir-ve-il-belediyeleri'});
  }
 }
 return result;
}
export function discoverTenderLinks(html,base){
 const origin=new URL(base).origin,result=[];
 for(const m of String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const label=plain(m[2]);const url=officialUrl(m[1].replaceAll('&amp;','&'),base);
  if(url&&new URL(url).origin===origin&&/(?:ihale|hizmet al.m|sat.n alma)/i.test(label+' '+new URL(url).pathname)&&!result.some(x=>x.url===url))result.push({url,label:label.slice(0,180)});
 }
 return result.slice(0,40);
}
export function isServiceNotice(text){
 const t=fold(text);
 if(/\bgemi(?:si)?\b|\bferibot\b|\btekne\b/.test(t)&&!/vinc|is makine|kamyon|lowbed/.test(t))return false;
 if(/(?:malzeme|ekipman|makine(?:si|leri)?|kamyon|forklift|lastik|yedek parca) alimi/.test(t)&&!/kirala|(?:nakliye|tasima|kaldirma) hizmet/.test(t))return false;
 return /vinc|is makine|kamyon|nakliye|nakliyat|forklift|manlift|kaldirma|sepetli|ekskavator|kepce|yukleyici|telehandler|kompaktor|silindir|greyder|damper|cekici|lowbed/.test(t)&&/kirala|nakliye|nakliyat|tasima hizmet|kaldirma hizmet|hizmet alimi|makine(?:si)? nakli/.test(t)&&!/satis|satilik|personel|operator arani|iptal|sonuclandi|tamamlandi|suresi doldu/.test(t);
}
function anchors(html){return [...String(html).matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>({attrs:m[1]+' '+m[3],href:m[2],text:plain(m[4]),inner:m[4],index:m.index}));}
function genericLabel(s){return !s||/^(?:incele|detay(?:lar)?|detaya git|detayli bilgi|goruntule|indir|pdf|tiklayiniz|devami|devamini oku|incelemek icin tiklayiniz)[ .!›»→↗]*$/i.test(fold(s));}
export function noticeLinkRecords(html,base){
 const origin=new URL(base).origin,result=[];
 function add(link,title,context=''){
  const url=officialUrl(link.href.replaceAll('&amp;','&'),base),label=plain(title);
  if(!url||new URL(url).origin!==origin||url===base||genericLabel(label)||label.length<15||label.length>350||!/(?:ihale|hizmet|alim|kirala|teklif|nakliye|tasima)/.test(fold(label)))return;
  if(/^(?:ihale|ihaleler|ihale ilanlari|ihale duyurulari|tum ihaleler|devam eden ihaleler|tamamlanan ihaleler)$/.test(fold(label)))return;
  const existing=result.find(x=>x.url===url);if(existing)return;
  result.push({url,title:label.slice(0,240),context:plain(context).slice(0,1600)});
 }
 const clean=String(html).replace(/<(script|style|svg|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ');
 // Read titles alongside generic detail links, rather than treating "İncele" as a title.
 for(const block of clean.matchAll(/<(tr|article)\b[^>]*>[\s\S]*?<\/\1\s*>/gi)){
  const content=block[0],links=anchors(content),heading=plain(content.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]);
  const cells=[...content.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>plain(x[1]));
  const title=heading||cells.find(isServiceNotice)||cells.filter(s=>s.length>=15&&!genericLabel(s)).sort((a,b)=>b.length-a.length)[0];
  for(const link of links)if(genericLabel(link.text)&&title)add(link,title,content);
 }
 for(const h of clean.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)){
  const after=clean.slice(h.index+h[0].length,h.index+h[0].length+2000).split(/<h[1-6]\b/i)[0];
  const link=anchors(after).find(a=>genericLabel(a.text)&&/(?:ihale|duyuru|ilan|detay|\.pdf(?:\?|$))/i.test(a.href));
  if(link)add(link,plain(h[1]),h[1]);
 }
 for(const link of anchors(clean)){
  const title=genericLabel(link.text)?plain(link.attrs.match(/\b(?:title|aria-label)=["']([^"']+)["']/i)?.[1]||link.inner.match(/\balt=["']([^"']+)["']/i)?.[1]):link.text;
  add(link,title);
 }
 return result.slice(0,200);
}
export function serviceNoticeRecords(html,base){return noticeLinkRecords(html,base).filter(x=>isServiceNotice(x.title)&&!/(?:tamamlandi|sonuclandi|iptal|suresi doldu)/.test(fold(x.context))).slice(0,30);}
export function serviceNoticeLinks(html,base){return serviceNoticeRecords(html,base).map(({url,title})=>({url,title}));}
export function nextNoticePage(html,base){
 const current=new URL(base);
 for(const link of anchors(html)){
  const url=officialUrl(link.href.replaceAll('&amp;','&'),base);if(!url||url===base||new URL(url).origin!==current.origin)continue;
  if((/\brel=["'][^"']*\bnext\b/i.test(link.attrs)||/^(?:sonraki(?: sayfa)?|ileri|›|»)$/.test(fold(link.text)))&&/(?:[?&](?:page|sayfa|p)=\d+|\/(?:sayfa|page)\/\d+)/i.test(url))return url;
 }
 const expected=Number(current.searchParams.get('page')||current.searchParams.get('sayfa')||current.pathname.match(/\/(?:sayfa|page)\/(\d+)/)?.[1]||1)+1;
 for(const link of anchors(html)){const url=officialUrl(link.href.replaceAll('&amp;','&'),base);if(url&&new URL(url).origin===current.origin&&link.text===String(expected)&&/(?:[?&](?:page|sayfa|p)=\d+|\/(?:sayfa|page)\/\d+)/i.test(url))return url;}
 return null;
}
// Robots permission controls automated reads only, never republication rights.
export function robotsAllows(text,target,agent='YukVincLeadRadar'){
 const groups=[];let current=null,hasRules=false;
 for(const line of String(text).split(/\r?\n/)){
  const [key,...rest]=line.split('#')[0].split(':');const value=rest.join(':').trim();
  if(key.trim().toLowerCase()==='user-agent'){
   if(!current||hasRules){current={agents:[],rules:[]};groups.push(current);hasRules=false;}current.agents.push(value.toLowerCase());
  }else if(current&&['allow','disallow'].includes(key.trim().toLowerCase())){hasRules=true;if(value)current.rules.push({allow:key.trim().toLowerCase()==='allow',path:value});}
 }
 const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.toLowerCase().includes(a)));
 const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 const u=new URL(target);const pathname=u.pathname+u.search;let best=null;
 for(const rule of selected.flatMap(g=>g.rules)){
  const pattern=rule.path.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replaceAll('*','.*');
  if(new RegExp('^'+pattern).test(pathname)&&(!best||rule.path.length>best.path.length||(rule.path.length===best.path.length&&rule.allow)))best=rule;
 }
 return !best||best.allow;
}
