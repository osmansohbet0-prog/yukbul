import {requireAdmin,json,fail,readJson} from '../_lib/core.js';
import {isolatedDb} from '../_lib/isolated-db.js';
import {seoMonitorStatus,runSeoMonitor} from '../_lib/seo-monitor.js';
export async function onRequestGet(context){const a=await requireAdmin(context);if(a.response)return a.response;try{return json(await seoMonitorStatus(context.env));}catch{return fail('SEO denetim alanı hazır değil.',503);}}
export async function onRequestPost(context){const a=await requireAdmin(context);if(a.response)return a.response;try{
 const data=await readJson(context.request,1024);
 if(data.action==='settings'){if(typeof data.enabled!=='boolean')return fail('Geçersiz ayar.');const db=await isolatedDb(context.env);await db.prepare('UPDATE seo_monitor SET enabled=? WHERE id=1').bind(data.enabled?1:0).run();return json(await seoMonitorStatus(context.env));}
 if(data.action!=='run')return fail('Geçersiz işlem.');
 const result=await runSeoMonitor(context.env,context.renderPublic);return json({...result,...await seoMonitorStatus(context.env)});
 }catch{return fail('SEO denetimi tamamlanamadı.',503);}}
