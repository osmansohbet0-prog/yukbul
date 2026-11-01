import {officialUrl,robotsAllows,serviceNoticeRecords,noticeLinkRecords,nextNoticePage} from './city-source-discovery.js';
const AGENT='YukVincLeadRadar/3.0 (+https://yukvinc.com.tr/is-talepleri/)';
export async function boundedSourceText(response,max=512000){
 if(!response.ok)throw Error('Kaynak HTTP '+response.status);
 const reader=response.body?.getReader();if(!reader)return '';
 let size=0;const parts=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Kaynak boyut sınırı aşıldı.');parts.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}
 const data=new Uint8Array(size);let offset=0;for(const p of parts){data.set(p,offset);offset+=p.length;}return new TextDecoder().decode(data);
}
const samePublisher=(a,b)=>new URL(a).hostname.replace(/^www\./,'')===new URL(b).hostname.replace(/^www\./,'');
function canonicalLocation(response,url,root,robots=false){
 const next=officialUrl(response.headers.get('location'),url);
 if(!response.headers.get('location')||!next||!samePublisher(root,next)||(robots&&new URL(next).pathname!=='/robots.txt'))throw Error('Kaynak güvenli olmayan bir adrese yönlendiriyor.');
 return next;
}
async function publisherRobots(url,fetcher){
 let address=new URL('/robots.txt',url).toString();
 for(let n=0;n<3;n++){
  const r=await fetcher(address,{redirect:'manual',headers:{'user-agent':AGENT},signal:AbortSignal.timeout(10000)});
  if([301,302,307,308].includes(r.status)){address=canonicalLocation(r,address,url,true);continue;}
  if(!r.ok||/html/i.test(r.headers.get('content-type')||''))throw Error('Tarama kuralları doğrulanamadı; kaynak okunmadı.');
  return boundedSourceText(r,64000);
 }
 throw Error('Robots yönlendirme sınırı aşıldı.');
}
function compactHtml(response){
 if(typeof HTMLRewriter==='undefined')return response;
 // Stream large inline scripts/images away, but cap original bytes as well.
 let rawBytes=0;
 const input=response.body.pipeThrough(new TransformStream({transform(chunk,controller){rawBytes+=chunk.byteLength;if(rawBytes>8*1024*1024)throw Error('Kaynak ham boyut sınırı aşıldı.');controller.enqueue(chunk);}}));
 const stripped=new HTMLRewriter().on('script,style,svg,noscript',{element(e){e.remove();}}).on('img',{element(e){const alt=e.getAttribute('alt');if(alt)e.replace(alt);else e.remove();}}).on('[style]',{element(e){e.removeAttribute('style');}});
 return stripped.transform(new Response(input,{headers:response.headers}));
}
export async function readPermittedHtmlPage(rawUrl,fetcher=fetch){
 const root=officialUrl(rawUrl);if(!root)throw Error('Yalnızca izinli resmî HTTPS alan adları okunabilir.');
 let url=root;
 for(let n=0;n<3;n++){
  const robots=await publisherRobots(url,fetcher);
  if(!robotsAllows(robots,url))throw Error('Kaynak tarama kuralları bu sayfanın okunmasına izin vermiyor.');
  const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'user-agent':AGENT,accept:'text/html,application/xhtml+xml'}});
  if([301,302,307,308].includes(response.status)){url=canonicalLocation(response,url,root);continue;}
  if(!response.ok||!/(?:text\/html|application\/xhtml\+xml)/i.test(response.headers.get('content-type')||''))throw Error('Resmî duyuru sayfası HTML olarak doğrulanamadı.');
  return {url,body:await boundedSourceText(compactHtml(response))};
 }
 throw Error('Sayfa yönlendirme sınırı aşıldı.');
}
export async function readPermittedHtml(rawUrl,fetcher=fetch){return (await readPermittedHtmlPage(rawUrl,fetcher)).body;}
export function htmlNoticeItems(body,url,now=Date.now()){
 return serviceNoticeRecords(body,url).filter(item=>{
  // A dated archive path is excluded conservatively, never called a fresh notice.
  const date=new URL(item.url).pathname.match(/\/(20\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$)/);
  return !date||Date.UTC(Number(date[1]),Number(date[2])-1,Number(date[3]))>=now-120*86400000;
 }).map(({url,title,context})=>({url,title,excerpt:context||title,published_at:null}));
}
export async function scanPermittedHtmlSource(url,{fetcher=fetch,maxPages=2}={}){
 const items=[],seenUrls=new Set(),visited=new Set();let next=url,recordsSeen=0,pagesRead=0,paginationError=null;
 while(next&&pagesRead<Math.max(1,Math.min(2,maxPages))&&!visited.has(next)){
  visited.add(next);let page;
  try{page=await readPermittedHtmlPage(next,fetcher);}catch(e){if(!pagesRead)throw e;paginationError=String(e?.message||'İkinci sayfa okunamadı.').slice(0,160);break;}
  pagesRead++;recordsSeen+=noticeLinkRecords(page.body,page.url).length;
  for(const item of htmlNoticeItems(page.body,page.url))if(!seenUrls.has(item.url)&&items.length<30){seenUrls.add(item.url);items.push(item);}
  next=nextNoticePage(page.body,page.url);
 }
 return {items,records_seen:recordsSeen,pages_read:pagesRead,pagination_error:paginationError};
}
