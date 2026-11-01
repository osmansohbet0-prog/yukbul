/**
 * Filter public search hits before sending them to YükVinç admin review.
 *
 * Search hits are UNTRUSTED. No item can publish itself. A platform's crawl
 * timestamp is not the author's publication timestamp. A firm's advertisement
 * is not a customer request.
 */
import {normalizeTR} from './radar-kocaeli-qualification.js';
import {isRecentSourcePublication} from './radar-kocaeli-search-plan.js';

const CRANE=/\b(vinc|hiyap|hiab|mobil vinc|kule vinc|sepetli vinc|manlift|sepetli platform|makasli platform)\b/;
const HEAVY_LIFT=/\b(makine indirme|makine montaj|agir makine kaldirma|pres makinesi yerlestirme|endustriyel montaj|prefabrik montaj|celik konstruksiyon montaji)\b/;
const CLEAR_NEED=/\b(vinc(?:e)?\s+(?:ihtiyacimiz var|ihtiyac vardir|lazim|araniyor|ar(?:iyoruz|anmaktadir))|kiralik vinc lazim|vinc teklifi istiyoruz|vinc kiralanacaktir|vinc kiralama ihalesi|vinc kiralama hizmet alimi|vinc ihtiyaci|fiyat teklifi alinacaktir|vinc kiralama teklifi)\b/;
const BUYER_WORD=/\b(ariyoruz|aranmakta|aranmaktadir|araniyor|lazim|ihtiyac|kiralayacagiz|kiralanacaktir|teklif istiyoruz|teklif alinacaktir|teklif toplanacaktir|fiyat teklifi|hizmet alimi|ihale)\b/;
const BUSINESS_CONTEXT=/\b(fabrikamiza|santiyemize|tesisimize|projemize|makinemizin|yerlestirme icin|montaji icin|kiralamak istiyoruz|kiralama talebi)\b/;
const BAD_PROVIDER=/\b(hizmetinizdeyiz|filomuz|kiralik vinclerimiz|vinclerimiz|kiraya veriyoruz|kiraya verilir|hizmet sunuyoruz|vinc hizmeti sunuyoruz|vinc kiralama firmasi|7 24 vinc kiralama hizmeti|vinc kiralama fiyatlari|vinc kiralama hizmetlerimiz)\b/;
const BAD_RECRUIT=/\b(vinc operatoru|mobil vinc operatoru|hiyap operatoru|vinc soforu|vinc kullanicisi)\s+(araniyor|alinacak|is ilani|alimi|istihdam)\b/;
const BAD_SALE=/\b(vinc satilik|satilik vinc|vinc satisi|vinc satin alma|vinc satin alinmasi|vinc mal alimi|koprulu gezer vinc alimi|raf sistemi|ikinci el vinc satis|gayrimenkul kiralama)\b/;
const KNOWN_LOCATIONS=[
 ['gebze',1],['dilovasi',1],['cayirova',1],['darica',1],['korfez',1],['kartepe',1],
 ['izmit',2],['derince',2],['basiskele',2],['tuzla',2],['pendik',2],
 ['altinova',2],['yalova',2],['sakarya',3],['kocaeli',2]
];
const TERM=/\b((?:\d+)\s*ay(?:lik|ligina)?|aylik|uzun vadeli|uzun donem|yillik|sozlesme suresi|proje boyunca|surekli)\b/;
function safeUrl(raw){
  try{
    const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.port ||
       !u.hostname.includes('.')||u.hostname==='localhost'||/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname))return null;
    u.hash='';
    // Preserve procurement identifiers; remove tracking-only query fields.
    for(const k of [...u.searchParams.keys()]){
      if(/^(utm_.+|fbclid|gclid|igshid|mc_cid|mc_eid)$/i.test(k))u.searchParams.delete(k);
    }
    return u.href;
  }catch{return null;}
}
function fingerprint(input){
  let value=2166136261;
  for(const c of input){value^=c.charCodeAt(0);value=Math.imul(value,16777619);}
  return 'kc-'+(value>>>0).toString(16).padStart(8,'0');
}
function checkPublishedAt(raw,now){
  if(!isRecentSourcePublication(raw,{now,hours:24}))return {recent:false,verified:false};
  return {recent:true,verified:true};
}
export function triageKocaeliSearchHit(hit,{now=Date.now()}={}){
  const base={status:'discard',reason:'',regionPriority:null,category:null,
    recent24h:false,term:'unknown',score:0,publiclyPublishable:false,
    sourceUrl:null,sourcePublishedAt:null,contactSourceVerified:false,
    needsAdminApproval:true};
  if(!hit||typeof hit!=='object')return {...base,reason:'invalid_record'};
  const title=String(hit.title||'').trim().slice(0,500);
  const description=String(hit.description||'').trim().slice(0,14000);
  const text=normalizeTR(title+' '+description);
  const location=normalizeTR([hit.city,hit.district,hit.location].filter(Boolean).join(' '));
  const url=safeUrl(hit.url);
  if(!url||text.length<12)return {...base,reason:'missing_source_or_text'};
  if(BAD_RECRUIT.test(text))return {...base,sourceUrl:url,reason:'personnel_recruitment'};
  if(BAD_SALE.test(text))return {...base,sourceUrl:url,reason:'sale_or_property'};
  if(BAD_PROVIDER.test(text))return {...base,sourceUrl:url,reason:'provider_advertisement'};
  if(!CRANE.test(text) && !(HEAVY_LIFT.test(text)&&BUSINESS_CONTEXT.test(text)))
    return {...base,sourceUrl:url,reason:'not_crane_or_heavy_lifting'};
  const buyerIntent=CLEAR_NEED.test(text) ||
    (BUYER_WORD.test(text) && (CRANE.test(text) || (HEAVY_LIFT.test(text)&&BUSINESS_CONTEXT.test(text))));
  if(!buyerIntent)return {...base,sourceUrl:url,reason:'buyer_intent_not_established'};
  const found=KNOWN_LOCATIONS.filter(([name])=>new RegExp('\\b'+name+'\\b').test(location));
  if(!found.length)return {...base,sourceUrl:url,reason:'location_unverified_or_outside_region'};
  const regionPriority=Math.min(...found.map(x=>x[1]));
  const recent=checkPublishedAt(hit.authorPublishedAt,now);
  const deadline=typeof hit.deadline==='string' ? hit.deadline.trim():null;
  const futureDeadline=deadline&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?[+-]\d{2}:\d{2}$/.test(deadline)&&
    Number.isFinite(Date.parse(deadline))&&Date.parse(deadline)>now;
  const pastDeadline=deadline&&Number.isFinite(Date.parse(deadline))&&Date.parse(deadline)<=now;
  if(pastDeadline)return {...base,sourceUrl:url,reason:'expired_tender_deadline',regionPriority};
  const longTerm=TERM.test(text)||Number(hit.durationMonths)>=1;
  const direct=CLEAR_NEED.test(text);
  const score=Math.min(100,(direct?55:37)+(regionPriority===1?18:10)+(longTerm?14:0)+(recent.recent?9:0)+
    (hit.sourceVerified===true?4:0));
  const status=hit.sourceVerified===true && hit.buyerVerified===true &&
    recent.recent && (futureDeadline || hit.openStatusConfirmed===true)
    ? 'fresh_confirmed_buyer' : 'admin_review';
  return {
    ...base,status,reason:status==='fresh_confirmed_buyer'?'recent_buyer_evidence':'check_source_date_buyer_and_bid_status',
    sourceUrl:url,sourcePublishedAt:recent.verified?hit.authorPublishedAt:null,
    recent24h:recent.recent,regionPriority,
    term:longTerm?'monthly_or_project':'daily_or_unknown',
    score,category:CRANE.test(text)?'crane_or_access':'industrial_lifting',
    contactSourceVerified:hit.publicBusinessContactVerified===true,
    fingerprint:fingerprint(url+'|'+normalizeTR(hit.organization||title))
  };
}
export function sortedReviewCandidates(hits,options={}){
  return hits.map(hit=>({hit,triage:triageKocaeliSearchHit(hit,options)}))
    .filter(x=>x.triage.status!=='discard')
    .sort((a,b)=>(a.triage.status==='fresh_confirmed_buyer'?-1:1)-
                  (b.triage.status==='fresh_confirmed_buyer'?-1:1) ||
                  b.triage.score-a.triage.score);
}
