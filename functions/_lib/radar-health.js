import {readingAllowed,republicationAllowed} from './radar-ai-review.js';
import {sourceWorkedRecently} from './radar-kocaeli-integration.js';
import {isRecentSourcePublication} from './radar-kocaeli-search-plan.js';

function provinceScope(source){try{const codes=JSON.parse(source.province_codes_json||'[]');return Array.isArray(codes)?codes.map(Number):[];}catch{return [];}}
function freshEvidence(item,now){
 // Discovery/creation time is not author publication time. Only a verified
 // source timestamp saved with the draft can count as a fresh buyer candidate.
 try{
  const evidence=JSON.parse(item.ai_draft?.evidence_json||'null');
  return evidence && !Array.isArray(evidence) &&
   (evidence.sourceChecked===true||evidence.triage?.sourcePublishedAt===evidence.authorPublishedAt) &&
   isRecentSourcePublication(evidence.authorPublishedAt,{now}) &&
   evidence.triage?.status!=='discard' && item.classification==='relevant';
 }catch{return false;}
}
export function buildRadarHealth(sources=[],items=[],{now=Date.now(),focusProvinceCode=41}={}){
 const epoch=Math.floor(now/1000),working=sources.filter(s=>readingAllowed(s)&&sourceWorkedRecently(s,epoch));
 const publicationReady=working.filter(s=>s.source_category==='public_tender'&&republicationAllowed(s,s.feed_url,epoch));
 const review=items.filter(x=>x.status==='review'&&!x.public_at);
 const focused=sources.filter(s=>provinceScope(s).includes(Number(focusProvinceCode)));
 const focusedWorking=working.filter(s=>provinceScope(s).includes(Number(focusProvinceCode)));
 const counts={registered:sources.length,enabled:sources.filter(s=>Number(s.enabled)===1).length,working:working.length,publicationReady:publicationReady.length,reviewCandidates:review.length,freshCandidates:review.filter(x=>freshEvidence(x,now)).length};
 const issues=[];
 if(!focusedWorking.length)issues.push({code:'focus_source_missing',title:'Öncelikli bölgede çalışan kaynak yok',detail:'Kayıtlı belediye bağlantısı, çalışan tarama kaynağı değildir.',action:'İl seçip erişim izni doğrulanabilen bir RSS/API veya resmî duyuru kaynağını tamamlayın.'});
 if(working.length&&!publicationReady.length)issues.push({code:'publication_rights_missing',title:'Otomatik yayın için kaynak izni eksik',detail:working.length+' kaynak çalışıyor; güncel yeniden yayın hakkı doğrulanmış çalışan kaynak yok.',action:'Kaynağın yeniden yayın koşullarını ve izin kanıtını kaydedin. Güven puanı bu iznin yerini tutmaz.'});
 if(review.length&&!counts.freshCandidates)issues.push({code:'candidate_publication_time_missing',title:'Adayların güncellik kanıtı eksik',detail:'Adayın sisteme bugün eklenmesi, kaynağın bugün yayımlandığını göstermez.',action:'Asıl duyurunun yayın tarihini kontrol edip kaynaklı AI taslağını yenileyin.'});
 const errors=sources.filter(s=>Number(s.enabled)===1&&Number(s.consecutive_errors)>0).length;
 if(errors)issues.push({code:'source_errors',title:errors+' etkin kaynak hata veriyor',detail:'Kaynak hataları, diğer kaynakların taranmasını durdurmaz.',action:'Kaynak panelindeki son hata ve erişim yöntemini kontrol edin.'});
 return {counts,focus:{provinceCode:Number(focusProvinceCode),registered:focused.length,working:focusedWorking.length},issues,measuredAt:epoch};
}
