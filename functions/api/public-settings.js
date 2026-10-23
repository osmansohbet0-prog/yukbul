import {json,getPublicSettings} from '../_lib/core.js';
export async function onRequestGet({env}) {
  try{return json({settings:await getPublicSettings(env),turnstile_site_key:env.TURNSTILE_SITE_KEY||'',google_client_id:env.GOOGLE_CLIENT_ID||''});}catch{return json({error:'Ayarlar şu an alınamadı.'},503);}
}
