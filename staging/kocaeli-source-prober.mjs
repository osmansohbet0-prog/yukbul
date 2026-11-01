/**
 * YükVinç isolated official-source reachability probe.
 * Preview D1 only; no customer contact, publishing, or public API.
 */
const SOURCES=Object.freeze({
 'kocaeli-gebze-duyurular-20261102':'https://www.gebze.bel.tr/duyurular_5.html',
 'kocaeli-cayirova-duyurular-20261102':'https://www.cayirova.bel.tr/duyurular',
 'kocaeli-darica-ihaleler-20261102':'https://www.darica.bel.tr/ihale-rehberi/',
 'kocaeli-korfez-duyurular-20261102':'https://www.korfez.bel.tr/duyurular',
 'kocaeli-imes-osb-duyurular-20261102':'https://www.imesdilovasi.org/duyurular/'
});
export function allowedPath(robots,path){
  let inAny=false,sawGroup=false;const allow=[],disallow=[];
  for(const original of String(robots).split(/\r?\n/)){
    const line=original.split('#')[0].trim();if(!line)continue;
    const separator=line.indexOf(':');if(separator<0)continue;
    const key=line.slice(0,separator).trim().toLowerCase();
    const value=line.slice(separator+1).trim();
    if(key==='user-agent'){
      if(sawGroup && (allow.length||disallow.length))inAny=false;
      if(value==='*')inAny=true;
      sawGroup=true;continue;
    }
    if(!inAny||!value)continue;
    if(key==='disallow')disallow.push(value);
    if(key==='allow')allow.push(value);
  }
  const effectivePrefix=p=>p.split('*')[0].replace(/\$$/,'');
  const match=list=>list.filter(p=>effectivePrefix(p)&&path.startsWith(effectivePrefix(p)));
  const d=Math.max(0,...match(disallow).map(x=>x.length));
  const a=Math.max(0,...match(allow).map(x=>x.length));
  return d===0||a>=d;
}
async function cappedText(response,max){
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>max)throw new Error('oversized');
  const reader=response.body?.getReader();if(!reader)throw new Error('no_body');
  let total=0;const parts=[];
  try{
    while(true){const r=await reader.read();if(r.done)break;
      total+=r.value.byteLength;if(total>max)throw new Error('oversized');
      parts.push(r.value);}
  }finally{await reader.cancel().catch(()=>{});}
  const output=new Uint8Array(total);let n=0;
  for(const p of parts){output.set(p,n);n+=p.byteLength;}
  return new TextDecoder().decode(output);
}
async function probe(url){
  const target=new URL(url);
  const opts={redirect:'manual',signal:AbortSignal.timeout(7000),headers:{
    'User-Agent':'YukVincRadar/1.0 (+https://yukvinc.com.tr)',Accept:'text/plain,text/html;q=0.8'}};
  let robots;
  try{robots=await fetch(target.origin+'/robots.txt',opts);}
  catch{return{ok:false,status:'ROBOTS_UNREACHABLE'};}
  if(robots.status!==200)return{ok:false,status:'ROBOTS_UNCONFIRMED_HTTP_'+robots.status};
  let rules;
  try{rules=await cappedText(robots,50000);}
  catch{return{ok:false,status:'ROBOTS_READ_ERROR'};}
  if(!allowedPath(rules,target.pathname))return{ok:false,status:'ROBOTS_BLOCKED'};
  let response;
  try{response=await fetch(url,{...opts,signal:AbortSignal.timeout(7000)});}
  catch{return{ok:false,status:'PAGE_UNREACHABLE'};}
  if(response.status!==200)return{ok:false,status:'PAGE_HTTP_'+response.status};
  if(!/text\/html/i.test(response.headers.get('content-type')||''))return{ok:false,status:'NOT_HTML'};
  let html;
  try{html=await cappedText(response,200000);}
  catch{return{ok:false,status:'PAGE_TOO_BIG_OR_INVALID'};}
  const plain=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,180000);
  const matches=(plain.match(/\b(?:vinç|vinc|hiyap|manlift|sepetli)\b/gi)||[]).length;
  return{ok:true,status:'PAGE_REACHABLE · equipment mentions '+matches+' · not a confirmed rental lead',count:matches};
}
export default {
  async fetch(){return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});},
  async scheduled(controller,env,ctx){
    ctx.waitUntil((async()=>{
      if(!env.DB)return;
      for(const id of Object.keys(SOURCES)){
        const row=await env.DB.prepare('SELECT feed_url FROM lead_radar_sources WHERE id=? AND enabled=0').bind(id).first();
        if(!row || row.feed_url!==SOURCES[id])continue;
        const result=await probe(SOURCES[id]);
        await env.DB.prepare('UPDATE lead_radar_sources SET last_scan_status=?,last_scan_at=unixepoch(),last_scan_count=?,last_success_at=CASE WHEN ? THEN unixepoch() ELSE last_success_at END WHERE id=? AND enabled=0')
          .bind(result.status,result.count||0,result.ok?1:0,id).run();
      }
    })());
  }
};
