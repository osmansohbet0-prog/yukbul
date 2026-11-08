import baseline,{requireAdmin,verifiedAccessAdminEmail} from './production-baseline.mjs';
import {scanUniversity} from '../university/crawler.js';
import {snapshot,page} from '../university/admin.js';
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/university-radar'||/^\/admin\/universiteler\/?$/.test(path)){
   if(!['GET','HEAD'].includes(request.method))return new Response('Yalnız okuma destekleniyor.',{status:405,headers});
   const auth=await requireAdmin({request,env});if(auth.response)return auth.response;
   if(env.ACCESS_AUDIENCE&&!(await verifiedAccessAdminEmail(request,env)))return new Response('Yönetici erişimi gerekli.',{status:403,headers});
   try{
    const data=await snapshot(env.DB);
    if(path.startsWith('/api/'))return Response.json(data,{headers});
    return new Response(request.method==='HEAD'?null:page(data,url.searchParams),{headers:{...headers,'content-type':'text/html; charset=utf-8'}});
   }catch{return Response.json({error:'Üniversite kaynak tabloları hazır değil.'},{status:503,headers});}
  }
  const response=await baseline.fetch(request,env,ctx);
  if(request.method==='GET'&&['/admin/','/admin'].includes(path)&&response.ok&&response.headers.get('content-type')?.includes('text/html')){
   return new HTMLRewriter().on('main',{element(el){el.prepend('<p><a href="/admin/universiteler/">Üniversite 4/B ve KPSS ilanları — kaynak kapsamı ve sağlık durumu</a></p>',{html:true});}}).transform(response);
  }
  return response;
 },
 async scheduled(controller,env,ctx){
  if(controller.cron==='*/2 * * * *'){
   ctx.waitUntil((async()=>{await scanUniversity(env);await scanUniversity(env);})().catch(e=>console.error(JSON.stringify({event:'university_scan_failed',name:e.name}))));return;
  }
  // Existing crane, lab, offer, inbox and SEO schedules remain intact.
  const original=baseline.scheduled(controller,env,ctx);
  return original;
 }
};
