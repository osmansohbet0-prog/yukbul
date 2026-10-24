import {fail,json,requireAdmin} from '../_lib/core.js';
import {RESOURCE_LIMITS} from '../_lib/resource-limits.js';
const number=value=>Number.isFinite(Number(value))?Number(value):0;
export async function onRequestGet(context){
 const admin=await requireAdmin(context);if(admin.response)return admin.response;const db=context.env.DB;if(!db)return fail('Veritabanına ulaşılamıyor.',503);
 try{
  const [users,listings,photos,ai]=await Promise.all([
   db.prepare('SELECT COUNT(*) AS count FROM users').first(),
   db.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS active,SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending FROM listings WHERE status<>'deleted'").first(),
   db.prepare('SELECT COALESCE(SUM(byte_size),0) AS bytes,COUNT(*) AS count FROM listing_photos').first(),
   db.prepare("SELECT COALESCE((SELECT SUM(length(CAST(user_message_redacted AS BLOB))+length(CAST(COALESCE(assistant_answer_redacted,'') AS BLOB))) FROM ai_conversations),0)+COALESCE((SELECT SUM(length(CAST(metadata_json AS BLOB))) FROM ai_audit),0)+COALESCE((SELECT SUM(length(CAST(summary_redacted AS BLOB))+length(CAST(COALESCE(contact_name,'') AS BLOB))+length(CAST(COALESCE(contact_details,'') AS BLOB))) FROM support_tickets),0)+COALESCE((SELECT SUM(length(CAST(title AS BLOB))+length(CAST(finding AS BLOB))+length(CAST(rationale AS BLOB))+length(CAST(proposal AS BLOB))) FROM ai_improvement_suggestions),0) AS bytes").first()
  ]);
  let databaseBytes=null;try{const pageCount=await db.prepare('PRAGMA page_count').first(),pageSize=await db.prepare('PRAGMA page_size').first();const pages=Number(Object.values(pageCount||{})[0]),size=Number(Object.values(pageSize||{})[0]);if(Number.isFinite(pages)&&Number.isFinite(size)&&pages>=0&&size>0)databaseBytes=pages*size}catch{}
  const metric=(value,limit)=>({value:value==null?null:number(value),limit:limit==null?null:number(limit),percent:limit&&value!=null?Math.min(100,Math.round(number(value)*100/number(limit))):null});
  return json({measured_at:new Date().toISOString(),metrics:{
   database:metric(databaseBytes,RESOURCE_LIMITS.databaseBytes),ai_data:metric(ai?.bytes,RESOURCE_LIMITS.aiDataBytes),photos:metric(photos?.bytes,RESOURCE_LIMITS.photoBytes),
   users:metric(users?.count,RESOURCE_LIMITS.users),listings:metric(listings?.total,RESOURCE_LIMITS.listings),active_listings:metric(listings?.active,null),pending_listings:metric(listings?.pending,null),photo_count:number(photos?.count)
  }});
 }catch(error){console.error('[admin-usage]',JSON.stringify({event:'metric_read_failed',name:error?.name||'Error'}));return fail('Kullanım verileri alınamadı. Migration’ları uyguladığını kontrol et.',503)}
}
