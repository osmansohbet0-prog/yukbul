import {json,getPublicSettings} from '../_lib/core.js';
export async function onRequestGet({env}) {
  try{return json({settings:await getPublicSettings(env)});}catch{return json({error:'Ayarlar şu an alınamadı.'},503);}
}
