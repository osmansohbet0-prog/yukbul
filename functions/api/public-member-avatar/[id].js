export async function onRequestGet({params,env}){
 const id=String(params.id||'');if(!/^[A-Za-z0-9_-]{8,80}$/.test(id)||!env.DB)return new Response(null,{status:404});
 const row=await env.DB.prepare("SELECT u.avatar_webp,u.avatar_updated_at FROM users u WHERE u.id=? AND u.active=1 AND u.avatar_webp IS NOT NULL AND EXISTS(SELECT 1 FROM listings l WHERE l.user_id=u.id AND l.status='approved' AND l.member_paused_at IS NULL AND (COALESCE(l.service_category,l.category_detail,l.category)='operator' OR u.role='admin' OR l.trial_expires_at>unixepoch() OR l.paid_until>unixepoch()))").bind(id).first();
 if(!row?.avatar_webp)return new Response(null,{status:404,headers:{'cache-control':'public,max-age=60'}});
 return new Response(row.avatar_webp,{headers:{'content-type':'image/webp','cache-control':'public,max-age=3600,stale-while-revalidate=86400','x-content-type-options':'nosniff'}});
}
