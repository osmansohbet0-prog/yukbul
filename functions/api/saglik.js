import {json,requireAdmin} from '../_lib/core.js';
const TABLES={
  users:['id','email_norm','role','active'],
  user_sessions:['token_hash','user_id','expires_at'],
  user_login_attempts:['ip_hash','action','created_at'],
  daily_listing_limits:['user_id','usage_date','count'],
  listings:['id','user_id','listing_type','category','title','description','city','district','status','content_hash'],
  listing_photos:['id','listing_id','mime_type','byte_size','image_blob'],
  ai_usage:['user_id','usage_date','count'],
  admin_activity:['action','entity_type','entity_id','metadata_json']
};
async function tableInfo(db,name){
  const rows=await db.prepare(`PRAGMA table_info("${name}")`).all();
  return new Set((rows.results||[]).map(row=>row.name));
}
async function diagnostics({env}){
  const report={
    ok:true,
    database:{binding:!!env.DB,reachable:false,tables:{}},
    storage:{r2_binding_configured_in_code:false,photo_storage:'D1 BLOB'},
    bindings:{workers_ai:!!env.AI,assets:!!env.ASSETS},
    secrets:{
      turnstile_secret:!!env.TURNSTILE_SECRET,
      admin_bootstrap_secret:!!env.ADMIN_BOOTSTRAP_SECRET,
      admin_security_code:!!env.ADMIN_SECURITY_CODE
    },
    public_config:{
      turnstile_site_key:!!env.TURNSTILE_SITE_KEY,
      google_client_id:!!env.GOOGLE_CLIENT_ID,
      ai_enabled:env.AI_ENABLED==='true'
    },
    listing_submit:{turnstile_enforced:false,photo_max_bytes:1800000},
    checked_at:new Date().toISOString()
  };
  if(!env.DB){
    report.ok=false;
    return Response.json(report,{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  try{
    await env.DB.prepare('SELECT 1 AS ok').first();
    report.database.reachable=true;
    try{
      const tracking=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'").first();
      if(tracking){
        const migrations=await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY name').all();
        report.database.migrations={tracking_table:true,applied:(migrations.results||[]).map(row=>String(row.name))};
      }else report.database.migrations={tracking_table:false,applied:[]};
    }catch{report.database.migrations={tracking_table:'unavailable',applied:[]}}
    for(const [name,required] of Object.entries(TABLES)){
      const columns=await tableInfo(env.DB,name);
      report.database.tables[name]={exists:columns.size>0,required_columns:required.map(column=>({name:column,exists:columns.has(column)}))};
    }
    const attempt=report.database.tables.user_login_attempts;
    if(attempt.exists){
      const row=await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_login_attempts'").first();
      const schema=String(row?.sql||'').toLowerCase();
      attempt.allows_listing_action=schema.includes("'listing'")||schema.includes('"listing"');
    }
    report.storage.photo_columns_ready=!!report.database.tables.listing_photos?.required_columns.every(x=>x.exists);
    report.ok=Object.values(report.database.tables).every(table=>table.exists&&table.required_columns.every(column=>column.exists));
  }catch(error){
    report.ok=false;
    report.database.reachable=false;
    console.error('[health] diagnostic query failed',error?.name||'Error',error?.message||'unknown');
  }
  return Response.json(report,{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}

export async function onRequestGet(context){
 if(new URL(context.request.url).searchParams.get('details')==='1'){const a=await requireAdmin(context);if(a.response)return a.response;return diagnostics(context)}
 try{if(!context.env.DB)return json({ok:false},503);await context.env.DB.prepare('SELECT 1 AS ok').first();return json({ok:true})}catch{return json({ok:false},503)}
}
