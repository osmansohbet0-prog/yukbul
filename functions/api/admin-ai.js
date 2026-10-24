import {fail,json,requireAdmin,readJson,audit} from '../_lib/core.js';
import {readAiModeration,cleanAiModeration} from '../_lib/ai-settings.js';
async function getStats(db){
 const stats={reviews_7d:0,flagged_7d:0,approved_7d:0,rejected_7d:0};
 try{const row=await db.prepare("SELECT COALESCE(SUM(count),0) AS n FROM ai_usage WHERE usage_date>=date('now','-6 days')").first();stats.reviews_7d=Number(row?.n||0)}catch{}
 try{const{results=[]}=await db.prepare("SELECT status,COUNT(*) AS n FROM listings WHERE created_at>=unixepoch()-604800 GROUP BY status").all();for(const row of results){if(row.status==='flagged')stats.flagged_7d=Number(row.n||0);if(row.status==='approved')stats.approved_7d=Number(row.n||0);if(row.status==='rejected')stats.rejected_7d=Number(row.n||0)}}catch{}
 let recent=[],feedback=[];
 try{const{results=[]}=await db.prepare("SELECT action,entity_id,metadata_json,created_at FROM admin_activity WHERE action LIKE 'ai.listing.%' ORDER BY created_at DESC LIMIT 12").all();recent=results}catch{}
 try{const{results=[]}=await db.prepare("SELECT l.title,l.category,json_extract(a.metadata_json,'$.to') AS decision,a.created_at FROM admin_activity a JOIN listings l ON l.id=a.entity_id WHERE a.action='listing.status.update' AND a.entity_type='listing' AND json_extract(a.metadata_json,'$.to') IN ('approved','rejected') ORDER BY a.created_at DESC LIMIT 8").all();feedback=results}catch{}
 return{stats,recent,feedback}
}
export async function onRequestGet(context){
 const auth=await requireAdmin(context);if(auth.response)return auth.response;
 try{const config=await readAiModeration(context.env.DB),extra=await getStats(context.env.DB);return json({config,stats:extra.stats,recent:extra.recent,feedback:extra.feedback,models:{text:'@cf/meta/llama-3.2-3b-instruct',image:'@cf/moondream/moondream3.1-9B-A2B'}})}catch{return fail('Yapay zekâ bilgileri alınamadı.',503)}
}
export async function onRequestPatch(context){
 const auth=await requireAdmin(context);if(auth.response)return auth.response;
 try{const body=await readJson(context.request,4096),config=cleanAiModeration(body.config);if(!config)return fail('Yapay zekâ ayarlarını kontrol et.');await context.env.DB.prepare("INSERT INTO site_settings(setting_key,value_json,updated_by,updated_at) VALUES('ai_moderation',?,?,unixepoch()) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(JSON.stringify(config),auth.admin.id).run();await audit(context.env,auth.admin.id,'ai.moderation.settings.update','site_settings','ai_moderation',{enabled:config.enabled,image_review:config.image_review,sensitivity:config.sensitivity});return json({ok:true,config})}catch{return fail('Yapay zekâ ayarları kaydedilemedi.',400)}
}
export async function onRequestPost(context){
 const auth=await requireAdmin(context);if(auth.response)return auth.response;
 try{
  const body=await readJson(context.request,4096);if(body.action!=='seo_suggestion')return fail('İstek türü geçersiz.');
  if(context.env.AI_ENABLED!=='true'||!context.env.AI)return fail('Yapay zekâ hizmeti şu anda kullanılamıyor.',503);
  const today=new Date().toISOString().slice(0,10);await context.env.DB.prepare('INSERT OR IGNORE INTO ai_usage(user_id,usage_date,count) VALUES(?,?,0)').bind(auth.admin.id,today).run();const quota=await context.env.DB.prepare('UPDATE ai_usage SET count=count+1 WHERE user_id=? AND usage_date=? AND count<5').bind(auth.admin.id,today).run();if(!quota.meta?.changes)return fail('Yapay zekâ günlük kullanım sınırına ulaştı.',429);
  const settings=await context.env.DB.prepare("SELECT value_json FROM site_settings WHERE setting_key='public_site'").first();
  let current={};try{current=JSON.parse(settings?.value_json||'{}')}catch{}
  const prompt={brand:'YükVinç',site:'Türkiye’de vinç, oto kurtarıcı, iş makinesi, sepetli platform, nakliyat asansörü ve operatör ilan pazaryeri',current_title:String(current.seo_title||'').slice(0,70),current_description:String(current.seo_description||'').slice(0,180)};
  const output=await context.env.AI.run('@cf/meta/llama-3.2-3b-instruct',{messages:[{role:'system',content:'YükVinç için Türkçe arama snippet önerileri yaz. Marka adını başlıkta doğal ve başta kullan. Arama sıralaması, iş hacmi, sertifika veya doğrulanmamış yerel adres iddiası üretme. Başlık en fazla 70 karakter, açıklama 40-180 karakter olsun. Yalnızca JSON döndür: {"title":"","description":"","notes":[]}.'},{role:'user',content:JSON.stringify(prompt)}],max_tokens:220,temperature:0.2});
  let raw=typeof output.response==='string'?output.response:JSON.stringify(output.response||output);raw=raw.trim();const fence=String.fromCharCode(96).repeat(3);if(raw.startsWith(fence)){raw=raw.slice(raw.indexOf('\n')+1);if(raw.endsWith(fence))raw=raw.slice(0,-3).trim()};const parsed=JSON.parse(raw);
  const clean=v=>String(v||'').replace(/<[^>]*>/g,'').replace(/[\\u0000-\\u001f]/g,' ').trim();
  const suggestion={title:clean(parsed.title).slice(0,70),description:clean(parsed.description).slice(0,180),notes:Array.isArray(parsed.notes)?parsed.notes.slice(0,3).map(x=>clean(x).slice(0,180)):[]};
  if(suggestion.title.length<10||suggestion.description.length<40)throw new Error('AI suggestion invalid');
  await audit(context.env,auth.admin.id,'ai.seo.suggestion','site_settings','public_site',{title:suggestion.title});
  return json({suggestion,publish_automatically:false});
 }catch(error){console.error('[admin-ai]',JSON.stringify({event:'seo_suggestion_failed',name:error?.name||'Error'}));return fail('SEO önerisi üretilemedi. Biraz sonra tekrar deneyin.',503)}
}
