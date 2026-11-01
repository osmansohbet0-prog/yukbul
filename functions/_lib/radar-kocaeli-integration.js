import {triageKocaeliSearchHit} from './radar-kocaeli-search-triage.js';
import {normalizeTR,qualifyCraneRentalRequest} from './radar-kocaeli-qualification.js';
import {isRecentSourcePublication} from './radar-kocaeli-search-plan.js';

export function inKocaeliScope(row) {
 return /\b(kocaeli|gebze|dilovasi|cayirova|darica|korfez|kartepe|izmit|derince|basiskele|golcuk|kandira|karamursel)\b/.test(normalizeTR([row.city,row.district,row.title].join(' ')));
}
export function isKocaeliCrane(row){return inKocaeliScope(row)&&/\b(vinc|hiyap|hiab|manlift|platform|kaldirma|makine indirme|makine montaj)\b/.test(normalizeTR([row.title,row.source_excerpt,row.excerpt,row.service_type].join(' ')));}
export function sourceWorkedRecently(s,now=Math.floor(Date.now()/1000)) {
 return Number(s.enabled)===1 && ['publisher_rss','explicitly_attested','robots_allowed'].includes(s.permission_status) && Number(s.last_success_at)>now-604800 && Number(s.last_success_at)<=now && Number(s.consecutive_errors)===0;
}
export function triageRadarRow(row,{authorPublishedAt=null,sourceVerified=false,now=Date.now()}={}) {
 return triageKocaeliSearchHit({title:row.title,description:row.source_excerpt||row.excerpt||row.public_summary||'',city:row.city,district:row.district,url:row.source_url||row.url,organization:row.organization,authorPublishedAt,sourceVerified,buyerVerified:false},{now});
}
// Only explicit publisher publication metadata counts. Never use dateModified,
// search-index dates, fetch time, arbitrary dates in prose or administrator input.
export function publisherPublication(html,now=Date.now()) {
 const candidates=[];
 for(const match of String(html).matchAll(/<meta\b[^>]*>/gi)) {
  const attrs=Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(x=>[x[1].toLowerCase(),x[2]]));
  if(['article:published_time','datepublished'].includes(String(attrs.property||attrs.name||attrs.itemprop).toLowerCase()))candidates.push(attrs.content);
 }
 for(const match of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
  try {const visit=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(visit);return;}if(x.datePublished)candidates.push(x.datePublished);if(x['@graph'])visit(x['@graph']);};visit(JSON.parse(match[1]));}catch{}
 }
 const valid=[...new Set(candidates.filter(x=>typeof x==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(x) && Number.isFinite(Date.parse(x)) && Date.parse(x)<=now))];
 // Conflicting dates require human investigation, not a favorable selection.
 return valid.length===1?valid[0]:null;
}
export function rentalContentAllowed(row) {
 const text=normalizeTR([row.title,row.source_excerpt,row.public_summary,row.service_type].join(' '));
 if(/\b(satilik|satin al\w*|mal alimi|raf sistemi|vinc satisi|operatoru araniyor|operator araniyor|personel alimi|ise alim|hizmetinizdeyiz|filomuz|kiraya veriyoruz|kiraya verilir|hizmet veriyoruz)\b/.test(text))return false;
 return true;
}
export function qualifiedKocaeliEvidence(row,evidence,now=Date.now()) {
 const authorPublishedAt=publisherPublication(evidence.body,now);
 const lead={...row,description:evidence.sentences.join(' '),sourceUrl:row.source_url,sourceChecked:true,buyerConfirmed:false,authorPublishedAt,deadline:evidence.expires_at?new Date(evidence.expires_at*1000).toISOString():null};
 const triage=triageKocaeliSearchHit({title:row.title,description:lead.description,city:row.city,district:row.district,url:row.source_url,authorPublishedAt,sourceVerified:true,buyerVerified:false,deadline:lead.deadline},{now});
 const qualification=qualifyCraneRentalRequest(lead,now);
 if(!rentalContentAllowed(row)||triage.status==='discard'||(qualification.decision==='reject'&&qualification.reason!=='not_crane_or_lift'))throw Error('Kayıt gerçek bir Kocaeli vinç kiralama talebi değil: '+(triage.reason||qualification.reason));
 if(!isRecentSourcePublication(authorPublishedAt,{now}))throw Error('Asıl kaynağın son 24 saat içindeki yayın zamanı doğrulanamadı. Aday incelemede kalır.');
 return {lead,triage,authorPublishedAt};
}
