import {json,fail,readJson,isAllowedOrigin} from '../_lib/core.js';
import {PUBLIC_FILTER} from '../_lib/directory.js';
export async function onRequestPost({request,env}){
 if(!isAllowedOrigin(request))return fail('Kaynak doğrulanamadı.',403);
 try{
 if(!env.METRICS_HASH_KEY)return json({ok:true,measured:false});
 const ua=request.headers.get('user-agent')||'';if(!ua||/bot|crawler|spider|headless|preview|facebookexternalhit|curl|python|wget/i.test(ua)||request.cf?.botManagement?.verifiedBot)return json({ok:true,measured:false});
 const d=await readJson(request,1024),id=String(d.id||''),kind=String(d.kind||'');if(!/^[A-Za-z0-9_-]{8,80}$/.test(id)||!['view','phone','whatsapp'].includes(kind))return fail('Olay geçersiz.');
 const item=await env.DB.prepare("SELECT id FROM listings WHERE id=? AND status='approved' AND "+PUBLIC_FILTER('listings')+" AND (category='operator' OR user_id IN (SELECT id FROM users WHERE role='admin') OR trial_expires_at>unixepoch() OR paid_until>unixepoch())").bind(id).first();if(!item)return fail('İlan bulunamadı.',404);
 const ip=request.headers.get('cf-connecting-ip');if(!ip)return json({ok:true,measured:false});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.METRICS_HASH_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);const hash=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(new Date().toISOString().slice(0,10)+'|'+ip+'|'+ua.slice(0,250)));const visitor=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 await env.DB.batch([
  env.DB.prepare('DELETE FROM listing_metric_dedup WHERE created_at<unixepoch()-86400'),
  env.DB.prepare('INSERT INTO listing_metric_dedup(id,listing_id,kind,visitor_hash) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM listing_metric_dedup WHERE listing_id=? AND kind=? AND visitor_hash=? AND created_at>unixepoch()-1800)').bind(crypto.randomUUID(),id,kind,visitor,id,kind,visitor),
  env.DB.prepare("INSERT INTO listing_metrics_daily(listing_id,day,kind,count) SELECT ?,date('now'),?,1 WHERE changes()=1 ON CONFLICT(listing_id,day,kind) DO UPDATE SET count=count+1").bind(id,kind),
  env.DB.prepare("DELETE FROM listing_metrics_daily WHERE day<date('now','-400 days')")
 ]);return json({ok:true,measured:true});
 }catch{return fail('Ölçüm alınamadı.',503)}
}
