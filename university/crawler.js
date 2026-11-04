import {robotsAllows,plainSourceText} from './text.js';
import {officialUrl,sameUniversity,candidateLinks,analyzeNotice,fold} from './analyze.js';
const AGENT='YukVincUniversityRadar/1.0 (+https://yukvinc.com.tr/)';
export async function boundedText(response,max=1500000){
 const reader=response.body?.getReader();if(!reader)return '';const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('size_limit');chunks.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}return new TextDecoder().decode(bytes);
}
export async function readOfficial(raw,{fetcher=fetch,headers={},robotsCache=new Map()}={}){
 let url=officialUrl(raw);if(!url)throw Error('invalid_official_url');const root=url;
 const request=address=>fetcher(address,{redirect:'manual',headers:{'user-agent':AGENT,...headers},signal:AbortSignal.timeout(10000)});
 for(let redirects=0;redirects<4;redirects++){
  const origin=new URL(url).origin;let rules=robotsCache.get(origin);
  if(rules===undefined){
   let r=await request(origin+'/robots.txt');
   // Robots redirects are accepted only within the same official publisher.
   for(let n=0;[301,302,307,308].includes(r.status)&&n<2;n++){
    const next=officialUrl(r.headers.get('location'),origin+'/robots.txt');
    if(!next||!sameUniversity(next,root)||new URL(next).pathname!=='/robots.txt')throw Error('robots_redirect');
    r=await request(next);
   }
   if(r.status===404)rules='';
   else if(r.ok&&!/html/i.test(r.headers.get('content-type')||''))rules=await boundedText(r,64000);
   else throw Error('robots_unavailable');
   robotsCache.set(origin,rules);
  }
  if(!robotsAllows(rules,url,'YukVincUniversityRadar'))throw Error('robots_disallowed');
  const r=await request(url);
  if([301,302,307,308].includes(r.status)){
   const next=officialUrl(r.headers.get('location'),url);if(!next||!sameUniversity(next,root))throw Error('unsafe_redirect');url=next;continue;
  }
  if(r.status===304)return {notModified:true,url,response:r};
  if(!r.ok)throw Error('http_'+r.status);
  if(!/(?:text\/html|application\/(?:rss\+xml|atom\+xml|xml)|text\/xml)/i.test(r.headers.get('content-type')||''))throw Error('unsupported_format');
  return {body:await boundedText(r),url,response:r};
 }
 throw Error('redirect_limit');
}
export function discoverLinks(body,base,homepage){
 const links=[];
 for(const m of body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const url=officialUrl(m[1].replaceAll('&amp;','&'),base),label=plainSourceText(m[2]).slice(0,180),f=fold(label+' '+m[1]);
  if(!url||!sameUniversity(url,homepage)||!/(?:personel|duyuru|rektorluk|insan.kaynak|announcement)/.test(f)||/ogrenci|student/.test(fold(label))||links.some(x=>x.url===url))continue;
  links.push({url,label:label||url,kind:/personel|insan.kaynak/.test(f)?'personnel':'rectorate'});
 }
 return links.sort((a,b)=>Number(b.kind==='personnel')-Number(a.kind==='personnel')).slice(0,6);
}
const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function scanUniversity(env,{fetcher=fetch,now=Math.floor(Date.now()/1000)}={}){
 const db=env.DB,token=crypto.randomUUID();
 let requests=0;const limitedFetch=(...args)=>{if(++requests>20)throw Error('request_budget');return fetcher(...args);};
 const source=await db.prepare("SELECT s.*,u.homepage FROM university_sources s LEFT JOIN university_catalog u ON u.id=s.university_id WHERE s.enabled=1 AND s.next_scan_at<=? AND s.lease_until<? AND s.kind<>'portal' ORDER BY s.next_scan_at,s.id LIMIT 1").bind(now,now).first();
 if(!source)return {scanned:0};
 const lease=await db.prepare('UPDATE university_sources SET lease_token=?,lease_until=? WHERE id=? AND lease_until<? AND next_scan_at<=?').bind(token,now+600,source.id,now,now).run();
 if(!lease.meta?.changes)return {scanned:0};
 const cache=new Map();let detailsFailed=0;
 try{
  // Read discovery pages without validators: unread job details must still advance on an unchanged index.
  const read=await readOfficial(source.url,{fetcher:limitedFetch,robotsCache:cache});
  if(read.notModified)throw Error('unexpected_304');
  if(source.homepage&&source.kind==='homepage')for(const link of discoverLinks(read.body,read.url,source.homepage)){
   await db.prepare('INSERT OR IGNORE INTO university_sources(id,university_id,kind,url,label,interval_seconds,next_scan_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM university_sources WHERE university_id=?)<8').bind(await hash(link.url),source.university_id,link.kind,link.url,link.label,link.kind==='personnel'?86400:172800,now+60,source.university_id).run();
  }
  const candidates=candidateLinks(read.body,read.url);
  for(const c of candidates){
   const id=await hash(c.url);
   await db.prepare('INSERT INTO university_notices(id,university_id,source_id,source_url,title,last_seen_at,first_seen_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(source_url) DO UPDATE SET last_seen_at=excluded.last_seen_at').bind(id,source.university_id,source.id,c.url,c.title,now,now).run();
   await db.prepare('INSERT INTO university_notice_links(notice_id,url,source_id,last_seen_at) VALUES(?,?,?,?) ON CONFLICT(url) DO UPDATE SET last_seen_at=excluded.last_seen_at').bind(id,c.url,source.id,now).run();
  }
  const pending=(await db.prepare("SELECT * FROM university_notices WHERE source_id=? AND (checked_at IS NULL OR checked_at<?) ORDER BY checked_at IS NOT NULL,checked_at,id LIMIT 3").bind(source.id,now-43200).all()).results||[];
  for(const job of pending){
   try{
    const detail=await readOfficial(job.source_url,{fetcher:limitedFetch,robotsCache:cache});
    const row=analyzeNotice(detail.body,{title:job.title,now});
    if(row.status==='open'&&source.university_id==null){row.status='unverified';row.reason='Üniversite eşleştirmesi gerekli.';}
    const fingerprint=await hash(JSON.stringify([source.university_id,fold(row.title),row.deadline,row.kpss_years,row.score_types,fold(plainSourceText(detail.body))]));
    const duplicate=await db.prepare('SELECT id FROM university_notices WHERE fingerprint=? AND id<>? AND duplicate_of IS NULL ORDER BY first_seen_at LIMIT 1').bind(fingerprint,job.id).first();
    await db.prepare('UPDATE university_notices SET title=?,role_tag=?,kpss_tag=?,kpss_years=?,score_types=?,status=?,deadline=?,starts_at=?,published_at=?,fingerprint=?,duplicate_of=?,evidence=?,reason=?,checked_at=?,failures=0 WHERE id=?').bind(row.title,row.role_tag,row.kpss_tag,JSON.stringify(row.kpss_years),JSON.stringify(row.score_types),row.status,row.deadline,row.starts_at,row.published_at,fingerprint,duplicate?.id||null,JSON.stringify(row.evidence),row.reason,now,job.id).run();
   }catch(e){
    detailsFailed++;await db.prepare("UPDATE university_notices SET status=?,reason=?,checked_at=?,failures=failures+1 WHERE id=?").bind(/http_404|http_410/.test(e.message)?'removed':'unverified',String(e.message).slice(0,120),now,job.id).run();
   }
  }
  const backlog=await db.prepare('SELECT COUNT(*) AS n FROM university_notices WHERE source_id=? AND checked_at IS NULL').bind(source.id).first();
  await db.prepare("UPDATE university_sources SET last_scan_at=?,last_success_at=?,health=?,permission_status='robots_allowed',last_error=?,failures=0,items_seen=?,next_scan_at=?,lease_until=0,lease_token=NULL WHERE id=? AND lease_token=?").bind(now,now,detailsFailed?'partial':'ok',detailsFailed?detailsFailed+' ilan okunamadı':null,candidates.length,now+(backlog?.n?900:source.interval_seconds),source.id,token).run();
  await db.prepare("UPDATE university_notices SET status='closed',reason='Son başvuru tarihi geçti.' WHERE status='open' AND deadline<=?").bind(now).run();
  return {scanned:1,source:source.id,found:candidates.length,checked:pending.length,errors:detailsFailed};
 }catch(e){
  const blocked=/robots/.test(e.message);
  await db.prepare('UPDATE university_sources SET last_scan_at=?,health=?,permission_status=?,last_error=?,failures=failures+1,next_scan_at=?,lease_until=0,lease_token=NULL WHERE id=? AND lease_token=?').bind(now,blocked?'blocked':'error',blocked?'blocked':'pending',String(e.message).slice(0,180),now+Math.min(172800,3600*2**Math.min(source.failures,5)),source.id,token).run();
  await db.prepare("UPDATE university_notices SET status='unverified',reason='Kaynak güncel olarak doğrulanamadı.' WHERE source_id=? AND status='open'").bind(source.id).run();
  return {scanned:1,errors:1,source:source.id};
 }
}
