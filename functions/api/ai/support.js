import {fail,json,isAllowedOrigin,readJson,randomId} from '../../_lib/core.js';
import {limited} from '../../_lib/member.js';
import {redactForAI} from '../../_lib/listings.js';
const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function onRequestPost({request,env}){
 if(!isAllowedOrigin(request))return fail('İstek kaynağı doğrulanamadı.',403);
 if(!env.DB)return fail('Talep şu an kaydedilemiyor.',503);
 try{
  if(await limited(env,request,'ai-support',3,3600))return fail('Kısa sürede çok fazla talep gönderildi. Daha sonra tekrar dene.',429);
  const d=await readJson(request,6000),message=String(d.message||'').trim(),consent=d.consent===true;
  if(message.length<8||message.length>3000)return fail('Talebin 8–3000 karakter arasında olmalı.');
  const id=randomId(16),summary=redactForAI(message).slice(0,3000),name=consent?redactForAI(String(d.name||'').trim()).slice(0,100):null,contact=consent?String(d.contact||'').trim().slice(0,254):null;
  let mailStatus=consent?'not_configured':'not_requested';
  await env.DB.prepare('INSERT INTO support_tickets(id,source,summary_redacted,contact_name,contact_details,consent_email,email_status) VALUES(?,?,?,?,?,?,?)').bind(id,'assistant',summary,name||null,contact||null,consent?1:0,mailStatus).run();
  await env.DB.prepare("INSERT INTO ai_audit(id,actor,action,outcome,metadata_json) VALUES(?,?,?,?,?)").bind(randomId(16),'visitor','support.ticket.create','stored',JSON.stringify({ticket_id:id,consent,summary})).run();
  if(consent&&env.EMAIL&&env.SUPPORT_EMAIL_TO&&env.SUPPORT_EMAIL_FROM){
   try{await env.EMAIL.send({to:env.SUPPORT_EMAIL_TO,from:{email:env.SUPPORT_EMAIL_FROM,name:'YükVinç Destek'},subject:'YükVinç destek talebi',text:'Talep: '+summary+'\nİsim: '+(name||'Belirtilmedi')+'\nİletişim: '+(contact||'Belirtilmedi'),html:'<p><b>Talep:</b> '+escapeHtml(summary)+'</p><p><b>İsim:</b> '+escapeHtml(name||'Belirtilmedi')+'</p><p><b>İletişim:</b> '+escapeHtml(contact||'Belirtilmedi')+'</p>'});mailStatus='sent'}catch(error){mailStatus='failed';console.error('[yukusta-support]',JSON.stringify({event:'email_failed',code:error?.code||'unknown'}))}
   await env.DB.prepare('UPDATE support_tickets SET email_status=?,updated_at=unixepoch() WHERE id=?').bind(mailStatus,id).run();
   await env.DB.prepare("INSERT INTO ai_audit(id,actor,action,outcome,metadata_json) VALUES(?,?,?,?,?)").bind(randomId(16),'system','support.ticket.email',mailStatus,JSON.stringify({ticket_id:id})).run();
  }else if(consent){mailStatus='not_configured';await env.DB.prepare('UPDATE support_tickets SET email_status=? WHERE id=?').bind(mailStatus,id).run()}
  return json({ok:true,id,email_status:mailStatus,message:mailStatus==='sent'?'Talebin kaydedildi ve yöneticimize iletildi.':'Talebin admin paneline kaydedildi. E-posta iletimi yapılandırılmadığı için yönetici panelinden takip edilecek.'},201)
 }catch(error){console.error('[yukusta-support]',JSON.stringify({event:'ticket_failed',name:error?.name||'Error'}));return fail('Talep kaydedilemedi. Lütfen iletişim sayfasını kullan.',503)}
}
