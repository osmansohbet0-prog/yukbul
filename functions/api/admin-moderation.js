import {json,fail,requireAdmin,readJson,audit,randomId} from '../_lib/core.js';
import {readModeration,cleanModeration,maskEmail,maskPhone} from '../_lib/moderation.js';
export async function onRequestGet(context){
 const a=await requireAdmin(context);if(a.response)return a.response;
 try{const db=context.env.DB,config=await readModeration(db);
  const {results:rows=[]}=await db.prepare("SELECT l.id,l.title,l.status,l.category,l.city,l.district,l.price_amount,l.price_unit,l.user_id,l.contact_phone,u.email,(unixepoch()-u.created_at)/86400 AS account_age_days,(SELECT COUNT(*) FROM listings x WHERE x.user_id=u.id) AS account_listings,(SELECT COUNT(*) FROM listings x WHERE x.user_id=u.id AND x.status='flagged') AS account_flagged,(SELECT COUNT(*) FROM listings x WHERE x.user_id=u.id AND x.status='rejected') AS account_rejected,r.risk_score,r.evidence_json FROM listings l JOIN users u ON u.id=l.user_id LEFT JOIN listing_reviews r ON r.listing_id=l.id WHERE l.status IN ('flagged','pending') ORDER BY COALESCE(r.risk_score,0) DESC,l.created_at ASC LIMIT 100").all();
  const items=rows.map(({email,contact_phone,evidence_json,...r})=>{let evidence={};try{evidence=JSON.parse(evidence_json||'{}')}catch{}return{...r,owner_email:maskEmail(email),contact_phone:maskPhone(contact_phone),evidence}});
  const {results:appeals=[]}=await db.prepare("SELECT a.id,a.listing_id,a.message_redacted,a.created_at,l.title FROM listing_appeals a JOIN listings l ON l.id=a.listing_id WHERE a.status='open' ORDER BY a.created_at DESC LIMIT 50").all();
  const feedback=await db.prepare("SELECT COUNT(*) AS count FROM moderation_feedback WHERE verdict='false_positive' AND created_at>unixepoch()-2592000").first();
  return json({config,items,appeals,threshold_suggestion:Number(feedback?.count||0)>=5?'Son 30 günde en az 5 yanlış alarm kaydı var. İlgili nedenleri inceleyip eşikleri manuel değerlendirin; otomatik değişiklik yapılmadı.':null});
 }catch{return fail('Denetim bilgileri alınamadı.',503)}
}
export async function onRequestPatch(context){
 const a=await requireAdmin(context);if(a.response)return a.response;
 try{const d=await readJson(context.request,24000),db=context.env.DB;
  if(d.config){const config=cleanModeration(d.config);if(!config)return fail('Eşikleri veya referans aralıklarını kontrol edin.');
   await db.prepare("INSERT INTO site_settings(setting_key,value_json,updated_by,updated_at) VALUES('listing_moderation',?,?,unixepoch()) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(JSON.stringify(config),a.admin.id).run();await audit(context.env,a.admin.id,'moderation.config.update','settings','listing_moderation',{});return json({ok:true});
  }
  if(!/^[A-Za-z0-9_-]{8,80}$/.test(String(d.id||'')))return fail('İlan kimliği geçersiz.');
  const listing=await db.prepare("SELECT id,user_id,status FROM listings WHERE id=? AND status<>'deleted'").bind(d.id).first();if(!listing)return fail('İlan bulunamadı.',404);
  if(d.action==='false_positive'){
   const evidence=await db.prepare('SELECT evidence_json FROM listing_reviews WHERE listing_id=?').bind(d.id).first();
   await db.prepare('INSERT INTO moderation_feedback(id,listing_id,admin_id,verdict,evidence_json) VALUES(?,?,?,?,?)').bind(randomId(16),d.id,a.admin.id,'false_positive',evidence?.evidence_json||'{}').run();
  }else if(d.action==='request_correction'){
   const note=String(d.note||'').trim();if(note.length<5||note.length>500)return fail('5–500 karakterlik bir düzeltme açıklaması yazın.');
   await db.prepare("UPDATE listings SET status='pending',moderation_note=?,updated_at=unixepoch() WHERE id=?").bind(note,d.id).run();
  }else if(d.action==='review_account'){
   // A review flag is evidence only, never a ban or a status change.
  }else if(d.action==='resolve_appeal'){
   await db.prepare("UPDATE listing_appeals SET status='reviewed' WHERE listing_id=? AND status='open'").bind(d.id).run();
  }else return fail('İşlem türü geçersiz.');
  await audit(context.env,a.admin.id,'moderation.'+d.action,'listing',d.id,{user_id:listing.user_id});return json({ok:true});
 }catch{return fail('Denetim işlemi kaydedilemedi.',400)}
}
