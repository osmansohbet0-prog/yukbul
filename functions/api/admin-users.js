import {maskEmail} from '../_lib/moderation.js';
import {fail,json,requireAdmin,readJson,audit} from '../_lib/core.js';

export async function onRequestGet(context){
 const a=await requireAdmin(context);
 if(a.response)return a.response;
 try{
  const q=(new URL(context.request.url).searchParams.get('q')||'').slice(0,100),x='%'+q+'%';
  const {results=[]}=await context.env.DB.prepare("SELECT id,email,role,active,created_at FROM users WHERE email LIKE ? ORDER BY created_at DESC LIMIT 200").bind(x).all();
  return json({items:results.map(row=>({...row,email:maskEmail(row.email)}))});
 }catch{return fail('Kullanıcılar alınamadı.',503);}
}

export async function onRequestPatch(context){
 const a=await requireAdmin(context);
 if(a.response)return a.response;
 try{
  const d=await readJson(context.request,4096),id=String(d.id||'');
  if(!/^[A-Za-z0-9_-]{8,80}$/.test(id))return fail('Kullanıcı durumu geçersiz.');
  if(d.action==='extend_days'){
   const days=Number(d.days);
   if(!Number.isInteger(days)||days<1||days>365)return fail('Uzatma süresi 1–365 gün olmalıdır.');
   const user=await context.env.DB.prepare("SELECT id FROM users WHERE id=? AND role='member'").bind(id).first();
   if(!user)return fail('Üye bulunamadı.',404);
   const result=await context.env.DB.prepare("UPDATE listings SET paid_until=MAX(COALESCE(paid_until,0),COALESCE(trial_expires_at,0),unixepoch())+?*86400,updated_at=unixepoch() WHERE user_id=? AND status<>'deleted' AND COALESCE(service_category,category_detail,category)<>'operator'").bind(days,id).run();
   const count=Number(result.meta?.changes||0);
   if(!count)return fail('Bu üyede uzatılabilecek ilan bulunamadı.',404);
   await audit(context.env,a.admin.id,'user.listing_terms.extend','user',id,{days,listing_count:count});
   return json({ok:true,days,listing_count:count});
  }
  const active=d.active;
  if(![0,1,false,true].includes(active))return fail('Kullanıcı durumu geçersiz.');
  const user=await context.env.DB.prepare('SELECT id,role,active FROM users WHERE id=?').bind(id).first();
  if(!user)return fail('Kullanıcı bulunamadı.',404);
  if(id===a.admin.id&&Number(active)===0)return fail('Kendi yönetici hesabını bu ekrandan kapatamazsın.',409);
  if(user.role==='admin'&&Number(active)===0)return fail('Başka yönetici hesapları kullanıcı panelinden kapatılamaz.',409);
  await context.env.DB.prepare('UPDATE users SET active=?,updated_at=unixepoch() WHERE id=?').bind(Number(active),id).run();
  if(Number(active)===0){
   await context.env.DB.prepare('DELETE FROM admin_sessions WHERE user_id=?').bind(id).run();
   await context.env.DB.prepare('DELETE FROM user_sessions WHERE user_id=?').bind(id).run();
  }
  await audit(context.env,a.admin.id,Number(active)?'user.enable':'user.disable','user',id,{});
  return json({ok:true});
 }catch{return fail('Kullanıcı durumu değiştirilemedi.',400);}
}
