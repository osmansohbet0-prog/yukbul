import {json,getPublicSettings} from '../_lib/core.js';
export async function onRequestGet({env}) {
  try{const settings=await getPublicSettings(env);const row=env.DB?await env.DB.prepare("SELECT value_json FROM site_settings WHERE setting_key='outreach'").first():null;let contact={};try{contact=JSON.parse(row?.value_json||'{}')}catch{}if(contact.contact_email&&String(contact.contact_email).toLowerCase()!==String(env.ADMIN_EMAIL||'').toLowerCase())settings.contact_email=contact.contact_email;if(contact.contact_phone)settings.contact_phone=contact.contact_phone;return json({settings,turnstile_site_key:env.TURNSTILE_SITE_KEY||'',google_client_id:env.GOOGLE_CLIENT_ID||''});}catch{return json({error:'Ayarlar şu an alınamadı.'},503);}
}
