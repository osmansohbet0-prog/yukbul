import {json,currentMember,cookieToken,digest,clearMemberCookie} from '../../_lib/member.js';
import {audit} from '../../_lib/core.js';
export async function onRequestPost({request,env}){const user=await currentMember(request,env),token=cookieToken(request);if(user&&token&&env.DB){await env.DB.prepare('DELETE FROM user_sessions WHERE token_hash=?').bind(await digest(token)).run();await audit(env,user.id,'member.logout','session',null,{})}return json({ok:true},200,{'set-cookie':clearMemberCookie()});}
