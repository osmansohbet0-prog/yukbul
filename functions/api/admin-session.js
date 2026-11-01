import {verifiedAccessAdminEmail} from '../_lib/access-admin.js';
import {json,fail,requireAdmin,randomId,setCookie,audit} from '../_lib/core.js';
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function maintainSession(context,userId,now){
 const outcomes=await Promise.allSettled([
  context.env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<=?').bind(now).run(),
  audit(context.env,userId,'admin.login.cloudflare_access','session',null,{})
 ]);
 outcomes.forEach((r,i)=>{if(r.status==='rejected')console.error('[admin-session]',JSON.stringify({event:'maintenance_failed',operation:i===0?'expired_cleanup':'audit_write',name:r.reason?.name||'Error'}));});
}
export async function onRequestGet(context){
 let stage='session_lookup';
 try{
  const current=await requireAdmin(context);
  if(!current.response)return json({user:{email:current.admin.email}});
  if(current.response.status!==401)return current.response;
  stage='access_verify';
  const email=await verifiedAccessAdminEmail(context.request,context.env),adminEmail=String(context.env.ADMIN_EMAIL||'').trim().toLowerCase();
  if(!email||!adminEmail||email!==adminEmail||!context.env.DB)return fail('Yönetici için Cloudflare Access doğrulaması gerekli.',401);
  stage='admin_lookup';
  const user=await context.env.DB.prepare("SELECT id,email FROM users WHERE email_norm=? AND role='admin' AND active=1").bind(adminEmail).first();
  if(!user)return fail('Bu e-posta etkin yönetici hesabıyla eşleşmiyor.',403);
  stage='session_create';
  const token=randomId(32),now=Math.floor(Date.now()/1000),expiry=now+1800;
  await context.env.DB.prepare('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await hash(token),user.id,expiry).run();
  // Authentication and persistent session creation remain mandatory.
  // Expired-row cleanup and audit delivery must not undo a successful sign-in.
  const maintenance=maintainSession(context,user.id,now).catch(error=>console.error('[admin-session]',JSON.stringify({event:'maintenance_failed',name:error?.name||'Error'})));
  if(context.ctx?.waitUntil)context.ctx.waitUntil(maintenance);else await maintenance;
  return json({user:{email:user.email}},200,{'set-cookie':setCookie(token,1800)});
 }catch(error){
  console.error('[admin-session]',JSON.stringify({event:'session_failed',stage,name:error?.name||'Error'}));
  return json({error:'Oturum kontrol edilemedi.',reference:stage},503);
 }
}
