import {requireAdmin,json,fail,readJson,audit,randomId} from '../_lib/core.js';
import {maskPhone,maskEmail} from '../_lib/moderation.js';
import {cleanDirectory,directoryStatements,suppressed,CONTACT_STATUSES} from '../_lib/directory.js';
import {outreachConfig,cleanOutreach,loadContact,assertContactable,buildMessage,validMessage,syncInbox,registerRequest,removeDirectoryListing} from '../_lib/outreach.js';
import {gmailConfigured,gmailClient,sendGmail} from '../_lib/gmail-outreach.js';
import {redactForAI} from '../_lib/listings.js';
export async function onRequestGet(context){
 const a=await requireAdmin(context);if(a.response)return a.response;
 try{
 const db=context.env.DB,url=new URL(context.request.url),source=url.searchParams.get('source'),status=url.searchParams.get('contact_status'),removed=url.searchParams.get('removed');let where="l.status<>'deleted'",args=[];
 if(source){where+=' AND COALESCE(d.source,\'owner\')=?';args.push(source)}if(status){where+=' AND d.contact_status=?';args.push(status)}if(removed==='1')where+=' AND d.removed_at IS NOT NULL';
 const{results:items=[]}=await db.prepare(`SELECT l.id,l.title,l.business_name,l.contact_phone,l.city,l.district,COALESCE(l.service_category,l.category_detail,l.category) category,l.status,d.source,d.unaware,d.contact_status,d.contact_note,d.contact_at,d.contact_email,d.neighborhood,d.latitude,d.longitude,d.location_precision,d.removed_at FROM listings l LEFT JOIN listing_directory d ON d.listing_id=l.id WHERE ${where} ORDER BY CASE WHEN d.source='map_no_website' THEN 0 ELSE 1 END,l.created_at DESC LIMIT 200`).bind(...args).all();
 const{results:requests=[]}=await db.prepare('SELECT r.id,r.listing_id,r.kind,r.note,r.due_at,r.created_at,l.title FROM outreach_requests r JOIN listings l ON l.id=r.listing_id WHERE r.resolved_at IS NULL ORDER BY r.due_at LIMIT 100').all();
 const config=await outreachConfig(db),budget=await db.prepare("SELECT count FROM outreach_budget WHERE day=date('now')").first();
 return json({items:items.map(x=>({...x,contact_note:redactForAI(x.contact_note),contact_phone:maskPhone(x.contact_phone),contact_email:maskEmail(x.contact_email),status:x.removed_at?'removed':x.status})),requests:requests.map(x=>({...x,note:redactForAI(x.note)})),config:{...config,contact_phone:maskPhone(config.contact_phone),contact_email:maskEmail(config.contact_email)},gmail_configured:gmailConfigured(context.env),attempts_today:budget?.count||0,measured_since:'Veri toplama yayından sonra başlar; geçmiş veri üretilmez.'});
 }catch{return fail('Firma kayıtları alınamadı.',503)}
}
export async function onRequestPost(context){
 const a=await requireAdmin(context);if(a.response)return a.response;
 try{
 const d=await readJson(context.request,15000),db=context.env.DB,env=context.env;
 if(d.action==='config'){
  const old=await outreachConfig(db),c=cleanOutreach({...d.config,contact_phone:d.config?.contact_phone||old.contact_phone,contact_email:d.config?.contact_email||old.contact_email});if(!c)return fail('Gönderici ayarlarını kontrol edin.');
  if(c.contact_email.toLowerCase()===String(env.ADMIN_EMAIL||'').toLowerCase())return fail('Bu iş için ayrı kurumsal e-posta kullanın.');
  await db.prepare("INSERT INTO site_settings(setting_key,value_json,updated_by,updated_at) VALUES('outreach',?,?,unixepoch()) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(JSON.stringify(c),a.admin.id).run();await audit(env,a.admin.id,'outreach.config','settings','outreach',{daily_cap:c.daily_cap,enabled:c.enabled});return json({ok:true});
 }
 if(d.action==='sync'){const r=await syncInbox(env,{force:true});await audit(env,a.admin.id,'outreach.inbox.sync','settings','outreach',{processed:r.processed||0});return json({ok:true,...r})}
 const id=String(d.id||'');if(!/^[A-Za-z0-9_-]{8,80}$/.test(id))return fail('İlan kimliği geçersiz.');
 if(d.action==='duplicates'){
  const phone=String(d.contact_phone||'').replace(/\D/g,'').slice(-10),business=String(d.business_name||'').trim();
  const{results:items=[]}=await db.prepare("SELECT id,title,city,district FROM listings WHERE id<>? AND status<>'deleted' AND ((?<>'' AND substr(replace(replace(replace(replace(replace(contact_phone,' ',''),'-',''),'(',''),')',''),'+',''),-10)=?) OR (?<>'' AND business_name=?)) LIMIT 10").bind(id,phone,phone,business,business).all();return json({items});
 }
 const x=await loadContact(db,id);if(!x)return fail('İlan bulunamadı.',404);
 if(d.action==='reveal'){await audit(env,a.admin.id,'directory.contact.reveal','listing',id,{});return json({contact_phone:x.contact_phone,contact_email:x.contact_email})}
 if(d.action==='history'){const{results:items=[]}=await db.prepare('SELECT id,body,state,recipient_email,created_at,updated_at FROM outreach_drafts WHERE listing_id=? ORDER BY created_at DESC LIMIT 50').bind(id).all();await audit(env,a.admin.id,'outreach.history.reveal','listing',id,{});return json({items:items.map(x=>({...x,recipient_email:maskEmail(x.recipient_email)}))})}
 if(d.action==='metadata'){
  const listing=await db.prepare('SELECT city,district FROM listings WHERE id=?').bind(id).first();const old=await db.prepare('SELECT * FROM listing_directory WHERE listing_id=?').bind(id).first();
  const meta=cleanDirectory({...old,...d.directory,contact_at:d.directory?.contact_at??(d.directory?.contact_status&&d.directory.contact_status!==old?.contact_status?Math.floor(Date.now()/1000):old?.contact_at),source:old?.source||'owner',unaware:d.directory?.contact_status&&d.directory.contact_status!=='Bilgilendirilmedi'?false:!!old?.unaware,contact_email:d.directory?.contact_email||old?.contact_email},listing);
  if(x.removed_at&&meta.contact_status!=='Kaldırma talebi')return fail('Kaldırılmış kayıt yeniden etkinleştirilemez.');
  await db.batch(await directoryStatements(db,id,meta,a.admin.id));await audit(env,a.admin.id,'directory.metadata','listing',id,{contact_status:meta.contact_status,location_precision:meta.location_precision});return json({ok:true});
 }
 if(d.action==='request'){const requestId=await registerRequest(env,x,String(d.kind),d.note,a.admin.id);return json({ok:true,request_id:requestId})}
 if(d.action==='remove'){if(!x.source||x.source==='owner')return fail('Bu işlem kamuya açık firma kayıtları içindir.');await removeDirectoryListing(env,x,a.admin.id);return json({ok:true,status:'removed'})}
 if(d.action==='resolve'){const r=await db.prepare('UPDATE outreach_requests SET resolved_at=unixepoch() WHERE id=? AND listing_id=? AND resolved_at IS NULL').bind(String(d.request_id||''),id).run();if(!r.meta?.changes)return fail('Açık talep bulunamadı.',404);await audit(env,a.admin.id,'outreach.request.resolve','listing',id,{request_id:d.request_id});return json({ok:true})}
 if(d.action==='draft'){
  if(gmailConfigured(env))await syncInbox(env,{force:true});await assertContactable(db,x);const c=await outreachConfig(db),body=buildMessage(x,c),draftId=randomId(16);
  await db.prepare('INSERT INTO outreach_drafts(id,listing_id,created_by,recipient_email,body) VALUES(?,?,?,?,?)').bind(draftId,id,a.admin.id,x.contact_email,body).run();await audit(env,a.admin.id,'outreach.draft','listing',id,{draft_id:draftId});return json({ok:true,draft_id:draftId,body,channel:x.contact_email?'email':'copy',recipient:maskEmail(x.contact_email)});
 }
 if(d.action==='send'||d.action==='copy'){
  if(d.admin_confirm!==true||d.iys_confirm!==true)return fail('Yönetici gönderim onayı ve İYS kontrolü gerekli.',403);
  const draft=await db.prepare("SELECT * FROM outreach_drafts WHERE id=? AND listing_id=? AND created_by=? AND state='draft' AND created_at>unixepoch()-86400").bind(String(d.draft_id||''),id,a.admin.id).first();if(!draft)return fail('Taslak süresi dolmuş veya daha önce işleme alınmış.',409);
  const c=await outreachConfig(db),body=String(d.body||'');if(!validMessage(body,c))return fail('Bağlantı eklemeyin; ücret/onay, gönderen ve ret cümlelerini koruyun.');
  let call=null;if(gmailConfigured(env)){call=await gmailClient(env);await syncInbox(env,{force:true,call})}await assertContactable(db,x);
  if(d.action==='copy'){await db.prepare('UPDATE outreach_drafts SET body=?,updated_at=unixepoch() WHERE id=?').bind(body,draft.id).run();await audit(env,a.admin.id,'outreach.copy','listing',id,{draft_id:draft.id,delivery:'unmeasured'});return json({ok:true,body,message:'Kopyalama hazır. Telefonunuzdan gönderim ölçülmez; iletişim durumunu elle güncelleyin.'})}
  if(!c.enabled||!call||!gmailConfigured(env))return fail('Ayrı Gmail bağlantısı ve gönderim ayarı tamamlanmadan gönderilemez.',503);
  if(!x.contact_email||x.contact_email!==draft.recipient_email)return fail('Firma e-postası değişmiş; yeni taslak hazırlayın.',409);
  const locked=await db.prepare("UPDATE outreach_drafts SET state='sending',body=?,updated_at=unixepoch() WHERE id=? AND state='draft'").bind(body,draft.id).run();if(!locked.meta?.changes)return fail('Taslak zaten işleme alındı.',409);
  const budget=await db.prepare("INSERT INTO outreach_budget(day,count) VALUES(date('now'),1) ON CONFLICT(day) DO UPDATE SET count=count+1 WHERE count<?").bind(c.daily_cap).run();
  if(!budget.meta?.changes){await db.prepare("UPDATE outreach_drafts SET state='draft' WHERE id=?").bind(draft.id).run();return fail('Günlük gönderim tavanına ulaşıldı.',429)}
  // Never auto retry: a timed out provider request may already have sent the email.
  try{if(await suppressed(db,x))throw Error('Firma ret listesine alındı.');const result=await sendGmail(call,String(env.OUTREACH_GMAIL_ADDRESS).toLowerCase(),x.contact_email,body,draft.id);await db.batch([db.prepare("UPDATE outreach_drafts SET state='sent',provider_id=?,updated_at=unixepoch() WHERE id=?").bind(result.id||null,draft.id),db.prepare("UPDATE listing_directory SET contact_status='Bilgilendirildi',unaware=0,contact_at=unixepoch() WHERE listing_id=?").bind(id)]);await audit(env,a.admin.id,'outreach.sent','listing',id,{draft_id:draft.id,recipient:maskEmail(x.contact_email)});return json({ok:true,message:'Gmail gönderimi kabul etti. Teslim ve okunma garanti edilmez.'})}
  catch{await db.prepare("UPDATE outreach_drafts SET state='unknown',updated_at=unixepoch() WHERE id=?").bind(draft.id).run();await audit(env,a.admin.id,'outreach.send.unknown','listing',id,{draft_id:draft.id});return fail('Gönderim sonucu belirsiz. Gmail Gönderilenler kutusunu kontrol edin; otomatik tekrar yapılmadı.',502)}
 }
 return fail('İşlem geçersiz.');
 }catch(e){return fail(e?.message||'İşlem tamamlanamadı.',400)}
}
