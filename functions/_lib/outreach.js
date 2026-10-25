import {audit,randomId} from './core.js';
import {SERVICE_LABELS,identityHashes,suppressed,dueInBusinessDays} from './directory.js';
import {gmailConfigured,gmailClient,replyCommand} from './gmail-outreach.js';
export const FEE_SENTENCE='Açılış döneminde ilan yayınlamak ücretsizdir. İleride ücretli paketler sunmayı planlıyoruz, böyle bir durumda onayınız olmadan sizden ücret alınmaz.';
export const RET_SENTENCE='Bu tür iletileri almak istemiyorsanız RET yazarak yanıtlayın.';
export async function outreachConfig(db){const row=await db.prepare("SELECT value_json FROM site_settings WHERE setting_key='outreach'").first();let c={};try{c=JSON.parse(row?.value_json||'{}')}catch{}return{sender_name:'',contact_phone:'',contact_email:'',daily_cap:20,enabled:false,...c}}
export function cleanOutreach(c){if(!c||typeof c.sender_name!=='string'||c.sender_name.length>100||/[\r\n<>]/.test(c.sender_name)||typeof c.contact_phone!=='string'||c.contact_phone.length>20||!/^[-+0-9 ()]*$/.test(c.contact_phone)||typeof c.contact_email!=='string'||c.contact_email.length>200||(c.contact_email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.contact_email))||!Number.isInteger(c.daily_cap)||c.daily_cap<1||c.daily_cap>100||typeof c.enabled!=='boolean')return null;return{sender_name:c.sender_name.trim(),contact_phone:c.contact_phone.trim(),contact_email:c.contact_email.trim(),daily_cap:c.daily_cap,enabled:c.enabled}}
export function buildMessage(x,c){
 if(!c.sender_name||!c.contact_phone||!c.contact_email)throw Error('Önce Gönderici ayarlarında ad soyad, kurumsal telefon ve e-posta girin.');
 const safe=v=>String(v||'').replace(/[\r\n]+/g,' ').trim();
 const text=`Merhaba ${safe(x.business_name||x.title)} yetkilisi, ben ${safe(c.sender_name)}. YükVinç, yeni açılan, bağımsız bir vinç, çekici ve nakliye ilan sitesidir. Firmanızın kamuya açık iletişim bilgileriyle (${safe(x.city)}/${safe(x.district)}, ${SERVICE_LABELS[x.category]||'ekipman'}) sitemizde bir ilan yayınlandı. ${FEE_SENTENCE} İlanı düzeltmek veya kaldırmak için bu mesaja KALDIR veya DÜZELT yazarak yanıt vermeniz yeterli, talebiniz en geç 3 iş günü içinde yerine getirilir. İletişim: ${c.contact_phone}, ${c.contact_email}. YükVinç adıyla aratarak ilanınızı görebilirsiniz. ${RET_SENTENCE}`;
 if(!validMessage(text,c))throw Error('Firma bilgilerinde bağlantı veya uygun olmayan içerik var; düzeltin.');return text;
}
export function validMessage(text,c){
 if(typeof text!=='string'||text.length<100||text.length>2200||!text.includes(FEE_SENTENCE)||!text.includes(RET_SENTENCE)||!text.includes('KALDIR veya DÜZELT')||!text.includes('en geç 3 iş günü')||!text.includes(c.sender_name)||!text.includes(c.contact_phone)||!text.includes(c.contact_email)||!text.includes('YükVinç'))return false;
 const withoutEmail=text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'');
 return !/(?:https?:|www\.|\b[a-z0-9-]+\.(?:com|net|org|tr|io|dev|co)\b|\b(?:t|wa)\.me\b)|asla ücret|garantili|garanti ediyor|kazancınızı|işinizi büyüt/iu.test(withoutEmail);
}
export async function loadContact(db,id){return db.prepare("SELECT l.id,l.title,l.business_name,l.contact_phone,l.city,l.district,COALESCE(l.service_category,l.category_detail,l.category) category,l.status,d.contact_email,d.source,d.removed_at FROM listings l LEFT JOIN listing_directory d ON d.listing_id=l.id WHERE l.id=? AND l.status<>'deleted'").bind(id).first()}
export async function assertContactable(db,x){if(!x||x.removed_at||x.status!=='approved'||!x.source||x.source==='owner')throw Error('Yalnızca yayındaki kamuya açık firma kayıtları bilgilendirilebilir.');if(await suppressed(db,x))throw Error('Firma ret/engel listesinde. Taslak ve gönderim engellendi.');}
export async function registerRequest(env,x,kind,note,actor=null){
 if(!['RET','KALDIR','DUZELT'].includes(kind))throw Error('Talep türü geçersiz.');
 const id=randomId(16),db=env.DB,statements=[db.prepare('INSERT INTO outreach_requests(id,listing_id,kind,note,due_at) VALUES(?,?,?,?,?)').bind(id,x.id,kind,String(note||'').slice(0,1000),dueInBusinessDays())];
 if(kind!=='DUZELT'){for(const hash of await identityHashes(x))statements.push(db.prepare('INSERT INTO outreach_suppression(identity_hash,reason,listing_id,actor_id) VALUES(?,?,?,?) ON CONFLICT(identity_hash) DO NOTHING').bind(hash,kind,x.id,actor));}
 statements.push(db.prepare("UPDATE listing_directory SET contact_status=?,contact_at=unixepoch(),updated_at=unixepoch() WHERE listing_id=?").bind(kind==='KALDIR'?'Kaldırma talebi':kind==='DUZELT'?'Düzeltme istedi':'Bilgilendirildi',x.id));
 await db.batch(statements);await audit(env,actor,'outreach.request.'+kind,'listing',x.id,{request_id:id});return id;
}
export async function removeDirectoryListing(env,x,actor){
 await registerRequest(env,x,'KALDIR','Yönetici yayından kaldırdı.',actor);
 await env.DB.batch([env.DB.prepare('UPDATE listing_directory SET removed_at=unixepoch(),updated_at=unixepoch() WHERE listing_id=?').bind(x.id),env.DB.prepare("UPDATE listings SET status='rejected',moderation_note='Firma kaldırma talebiyle yayından kaldırıldı.',updated_at=unixepoch() WHERE id=?").bind(x.id),env.DB.prepare("UPDATE outreach_requests SET resolved_at=unixepoch() WHERE listing_id=? AND kind='KALDIR' AND resolved_at IS NULL").bind(x.id)]);
 await audit(env,actor,'listing.directory.removed','listing',x.id,{});
}
export async function syncInbox(env,{force=false,call=null}={}){
 if(env.DB){const maintenance=await env.DB.prepare("INSERT INTO site_settings(setting_key,value_json,updated_at) VALUES('directory_maintenance','{}',unixepoch()) ON CONFLICT(setting_key) DO UPDATE SET updated_at=unixepoch() WHERE updated_at<unixepoch()-3600").run();if(maintenance.meta?.changes)await env.DB.batch([env.DB.prepare('DELETE FROM outreach_drafts WHERE updated_at<unixepoch()-15552000'),env.DB.prepare('DELETE FROM outreach_inbox WHERE processed_at<unixepoch()-3888000'),env.DB.prepare('DELETE FROM listing_metric_dedup WHERE created_at<unixepoch()-86400'),env.DB.prepare("DELETE FROM listing_metrics_daily WHERE day<date('now','-400 days')")]);}
 if(!gmailConfigured(env))return{configured:false};
 const config=await outreachConfig(env.DB);if(!config.enabled&&!force)return{disabled:true};
 const db=env.DB;
 if(!force){const r=await db.prepare("INSERT INTO site_settings(setting_key,value_json,updated_at) VALUES('outreach_inbox_poll','{}',unixepoch()) ON CONFLICT(setting_key) DO UPDATE SET updated_at=unixepoch() WHERE updated_at<unixepoch()-300").run();if(!r.meta?.changes)return{throttled:true}}
 const gmail=call||await gmailClient(env);let page='',processed=0,read=0;
 for(let n=0;n<10;n++){
  const list=await gmail('messages?'+new URLSearchParams({q:'in:inbox newer_than:30d',maxResults:'100',...(page?{pageToken:page}:{})}));
  for(const entry of list.messages||[]){if(await db.prepare('SELECT message_id FROM outreach_inbox WHERE message_id=?').bind(entry.id).first())continue;
   if(read++>=20)throw Error('Gmail yanıt kuyruğu işleniyor; yeni taslak ve gönderim geçici durduruldu. Sonraki kontrolde devam eder.');
   const mail=await gmail('messages/'+encodeURIComponent(entry.id)+'?format=full'),headers=mail.payload?.headers||[],from=String(headers.find(h=>h.name.toLowerCase()==='from')?.value||''),email=(from.match(/<([^<>]+)>/)?.[1]||from).trim().toLowerCase(),kind=replyCommand(mail.payload);
   if(kind&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)){
    const{results:matches=[]}=await db.prepare("SELECT DISTINCT d.listing_id FROM listing_directory d JOIN outreach_drafts o ON o.listing_id=d.listing_id WHERE lower(d.contact_email)=? AND o.state IN ('sent','unknown')").bind(email).all();
    for(const row of matches){const x=await loadContact(db,row.listing_id);if(x)await registerRequest(env,x,kind,'Gmail yanıtından alındı.',null);processed++}
   }
   await db.prepare('INSERT OR IGNORE INTO outreach_inbox(message_id) VALUES(?)').bind(entry.id).run();
  }
  page=list.nextPageToken;if(!page)return{configured:true,processed};
 }
 throw Error('Gmail yanıt kuyruğu büyük; yeni taslak/gönderim durduruldu. Gelen yanıtları panelden işleyin.');
}
