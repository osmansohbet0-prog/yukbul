import {json,fail,isAllowedOrigin,cookieValue,clearCookie,digest,audit} from '../_lib/core.js';
export async function onRequestPost({request,env}) {
 if(!isAllowedOrigin(request))return fail('İstek kaynağı doğrulanamadı.',403);
 try{const token=cookieValue(request);if(token&&env.DB){const hash=await digest(token),row=await env.DB.prepare('SELECT user_id FROM admin_sessions WHERE token_hash=?').bind(hash).first();if(row){await audit(env,row.user_id,'admin.logout','session',null,{});await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(hash).run();}}return json({ok:true},200,{'set-cookie':clearCookie()});}catch{return json({ok:true},200,{'set-cookie':clearCookie()});}
}
