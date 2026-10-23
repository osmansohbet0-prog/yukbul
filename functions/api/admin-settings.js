import {fail,json,requireAdmin,readJson,audit,getPublicSettings,validateSettings,cleanSiteSettings} from '../_lib/core.js';
export async function onRequestGet(context){try{const a=await requireAdmin(context);if(a.response)return a.response;return json({settings:await getPublicSettings(context.env)});}catch{return fail('Tasarım ayarları alınamadı.',503);}}
export async function onRequestPut(context){
 const a=await requireAdmin(context);if(a.response)return a.response;
 try{const body=await readJson(context.request,12000),error=validateSettings(body.settings);if(error)return fail(error);const settings=cleanSiteSettings(body.settings);await context.env.DB.prepare("INSERT INTO site_settings(setting_key,value_json,updated_by,updated_at) VALUES('public_site',?,?,unixepoch()) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(JSON.stringify(settings),a.admin.id).run();await audit(context.env,a.admin.id,'site.settings.update','site_settings','public_site',{fields:Object.keys(settings)});return json({ok:true,settings});}catch{return fail('Ayarlar kaydedilemedi.',400);}
}
