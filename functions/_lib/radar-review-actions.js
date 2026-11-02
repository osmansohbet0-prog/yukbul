import { requireAdmin } from './core.js';
import { readingAllowed, republicationAllowed, sourceSentences, sourceHash, createGroundedDraft } from './radar-ai-review.js';
import {readPermittedHtml} from './radar-html-source.js';
import {inKocaeliScope,isKocaeliCrane,qualifiedKocaeliEvidence,rentalContentAllowed} from './radar-kocaeli-integration.js';
import {draftRadarLeadWithAI} from './radar-ai-editor.js';
import {extractInstitutionalContact} from './radar-kocaeli-contact-extractor.js';
import {saveBuyerContactForAdmin} from './radar-buyer-contacts.js';

const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});
const id=()=>crypto.randomUUID().replaceAll('-','');
export async function reviewSource(env,row,helpers) {
 const source=await env.DB.prepare('SELECT * FROM lead_radar_sources WHERE id=?').bind(row.source_id).first();
 if(!readingAllowed(source))throw Error('Kaynağın tarama izni doğrulanmamış veya kaynak kapalı.');
 const url=helpers.safeUrl(row.source_url),feed=helpers.safeUrl(source.feed_url);
 if(!url||!feed||url.hostname!==feed.hostname)throw Error('Duyuru alan adı izinli kaynakla eşleşmiyor.');
 let body;
 if(source.access_method==='permitted_html')body=await readPermittedHtml(url.toString());
 else {const response=await fetch(url,{redirect:'manual',headers:{accept:'text/html,application/xhtml+xml','user-agent':'YukVincLeadRadar/3.0 (+https://yukvinc.com.tr/is-talepleri/)'},signal:AbortSignal.timeout(8000)});if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('Asıl duyuru HTML olarak doğrulanamadı.');body=await helpers.boundedBody(response);}
 const sentences=sourceSentences(body),text=sentences.join(' ');
 const words=helpers.fold(row.title).split(' ').filter(w=>w.length>3),hay=helpers.fold(text);
 if(!words.length||words.filter(w=>hay.includes(w)).length/words.length<.6||!helpers.isClearBuyerNeed(text)||/ihale iptal|duyuru iptal|iptal edilmistir|iptal edildi/.test(hay))throw Error('Asıl sayfa güncel hizmet alımı duyurusuyla eşleşmedi.');
 if(!rentalContentAllowed({...row,source_excerpt:text}))throw Error('Satın alma, personel veya firma reklamı kiralama talebi olarak yayımlanamaz.');
 const evidence={source,sentences,body,expires_at:helpers.extractDeadline('',text)};
 if(isKocaeliCrane(row))evidence.kocaeli=qualifiedKocaeliEvidence(row,evidence);
 return evidence;
}
export async function generateReviewDraft(env,row,actor,helpers,expectedRevision='') {
 const evidence=await reviewSource(env,row,helpers);
 let draft;
 if(evidence.kocaeli){
  if(env.AI_ENABLED!=='true')throw Error('Workers AI şu anda kullanılamıyor.');
  const generated=await draftRadarLeadWithAI(env,{internalVerified:true},evidence.kocaeli.lead,evidence.sentences.join(' '),Date.now(),{persist:false});
  if(!generated.ok)throw Error('AI taslağı hazırlanamadı: '+generated.reason);
  draft={summary:generated.description,source_hash:await sourceHash(evidence.sentences),evidence:{sentences:evidence.sentences,authorPublishedAt:evidence.kocaeli.authorPublishedAt,title:generated.title,triage:evidence.kocaeli.triage,missingFacts:generated.missingFacts}};
 }else draft=await createGroundedDraft(env,row,evidence.sentences);
 const revision=id();
 const statement=env.DB.prepare(`INSERT INTO lead_radar_ai_drafts(lead_id,revision,summary,source_hash,expires_at,evidence_json,generated_by)
 SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM lead_radar_leads WHERE id=? AND status IN ('review','approved') AND public_at IS NULL)
 AND COALESCE((SELECT revision FROM lead_radar_ai_drafts WHERE lead_id=?),'')=?
 ON CONFLICT(lead_id) DO UPDATE SET revision=excluded.revision,summary=excluded.summary,source_hash=excluded.source_hash,expires_at=excluded.expires_at,evidence_json=excluded.evidence_json,generated_by=excluded.generated_by,generated_at=unixepoch()`)
 .bind(row.id,revision,draft.summary,draft.source_hash,evidence.expires_at,JSON.stringify(draft.evidence),actor,row.id,row.id,expectedRevision);
 const results=await env.DB.batch([statement,env.DB.prepare("INSERT INTO lead_radar_review_events(id,lead_id,actor,action,revision) SELECT ?,?,?,'rewrite',? WHERE changes()=1").bind(id(),row.id,actor,revision)]);
 if(!results[0].meta?.changes)throw Error('Kayıt veya önizleme değişti. Listeyi yenileyin.');
 // Contact extraction is independent of publication and never copies contacts
 // into the draft. A failed extraction must not lose a valid review draft.
 if(row.organization&&inKocaeliScope(row))try{
  const contact=extractInstitutionalContact({publicContent:evidence.body,sourceUrl:row.source_url,sourceKind:'official_tender',organizationVerified:true});
  if(contact.ok)await saveBuyerContactForAdmin(env.DB,{adminVerified:true},{id:'contact-'+row.id,leadId:row.id,organization:row.organization,city:row.city,district:row.district,businessPhone:contact.phone,businessEmail:contact.email,contactSourceUrl:row.source_url,sourceKind:'official_tender',demandStatus:'unknown',sourceChecked:true,publicBusinessContact:true,buyerNote:'Kurum iletişimi; açık iş veya teklif kabulü ayrıca doğrulanmalıdır.'});
 }catch{}
 return {revision,summary:draft.summary,expires_at:evidence.expires_at};
}
export async function handleReviewPatch({request,env},helpers) {
 const auth=await requireAdmin({request,env});if(auth.response)return auth.response;
 try {
  const d=await helpers.readJson(request),key=String(d.id||''),action=String(d.action||'');
  if(!/^[A-Za-z0-9_-]{8,80}$/.test(key))return reply({error:'Kayıt kimliği geçersiz.'},400);
  const row=await env.DB.prepare('SELECT * FROM lead_radar_leads WHERE id=?').bind(key).first();
  if(!row)return reply({error:'Talep bulunamadı.'},404);
  const actor=String(auth.admin.id),draft=await env.DB.prepare('SELECT * FROM lead_radar_ai_drafts WHERE lead_id=?').bind(key).first();
  if(action==='rewrite') {
   if(row.public_at||!['review','approved'].includes(row.status))return reply({error:'Bu kaydın durumu yeniden yazmaya uygun değil.'},409);
   if(String(d.revision||'')!==String(draft?.revision||''))return reply({error:'Önizleme değişti. Listeyi yenileyin.'},409);
   return reply({ok:true,draft:await generateReviewDraft(env,row,actor,helpers,String(d.revision||''))});
  }
  if(action==='publish'||action==='approve_publish') {
   if(row.public_at||!['review','approved'].includes(row.status))return reply({error:'Kayıt yayınlanmaya uygun değil.'},409);
   if(!draft||d.revision!==draft.revision||Date.now()/1000-draft.generated_at>86400)return reply({error:'Önizleme eksik, değişmiş veya eskimiş. Yeniden Yazdır ile yenileyin.'},409);
   if(d.verified_now!==true)return reply({error:'Asıl duyuruyu kontrol ettiğinizi onaylayın.'},400);
   const evidence=await reviewSource(env,row,helpers);
   if(!republicationAllowed(evidence.source,row.source_url))return reply({error:'Tarama izni yayın izni değildir. Kaynağın güncel yeniden yayın yetkisi doğrulanmadan yönetici onayıyla da yayımlanamaz.'},403);
   if(await sourceHash(evidence.sentences)!==draft.source_hash)return reply({error:'Asıl duyuru değişti. Yeniden Yazdır ile yeni önizlemeyi inceleyin.'},409);
   if(!draft.expires_at||draft.expires_at<=Math.floor(Date.now()/1000)||draft.expires_at!==evidence.expires_at)return reply({error:'Kaynakta doğrulanmış ve geçmemiş son başvuru tarihi gerekli.'},409);
   const results=await env.DB.batch([
    env.DB.prepare(`UPDATE lead_radar_leads SET status='approved',verification='manual_reviewed',public_summary=?,public_at=unixepoch(),public_expires_at=?,verified_at=unixepoch(),publication_method='manual',updated_at=unixepoch()
     WHERE id=? AND status IN ('review','approved') AND public_at IS NULL AND EXISTS(SELECT 1 FROM lead_radar_ai_drafts WHERE lead_id=? AND revision=?)
     AND EXISTS(SELECT 1 FROM lead_radar_sources WHERE id=? AND enabled=1 AND terms_attested=1 AND ((access_method='permitted_html' AND permission_status='robots_allowed') OR permission_status IN ('publisher_rss','explicitly_attested')) AND republish_attested=1 AND republish_checked_at>=unixepoch()-7776000 AND republish_checked_at<=unixepoch() AND republish_terms_url=?)`)
     .bind(draft.summary,draft.expires_at,key,key,draft.revision,row.source_id,evidence.source.republish_terms_url),
    env.DB.prepare("INSERT INTO lead_radar_review_events(id,lead_id,actor,action,revision) SELECT ?,?,?,'approve_publish',? WHERE changes()=1").bind(id(),key,actor,draft.revision)
   ]);
   if(!results[0].meta?.changes)return reply({error:'Yayın durumu veya kaynak izni değişti. Listeyi yenileyin.'},409);
   return reply({ok:true,published:true});
  }
  if(action==='unpublish'||action==='reject'||d.status==='dismissed') {
   const reject=action!=='unpublish';
   const results=await env.DB.batch([
    env.DB.prepare(`UPDATE lead_radar_leads SET public_at=NULL,${reject?"status='dismissed',":''}updated_at=unixepoch() WHERE id=?`).bind(key),
    env.DB.prepare('INSERT INTO lead_radar_review_events(id,lead_id,actor,action,revision) VALUES(?,?,?,?,?)').bind(id(),key,actor,reject?'reject':'unpublish',draft?.revision||null)
   ]);
   return reply({ok:Boolean(results[0].meta?.changes),published:false});
  }
  return reply({error:'Önizlemedeki Onayla ve Yayımla, Yeniden Yazdır veya Reddet işlemini kullanın.'},400);
 }catch(e){return reply({error:String(e?.message||'İşlem tamamlanamadı.').slice(0,220)},400);}
}
