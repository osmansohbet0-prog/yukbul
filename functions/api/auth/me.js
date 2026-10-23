import {json,fail,currentMember} from '../../_lib/member.js';
export async function onRequestGet({request,env}){if(!env.DB)return fail('D1 henüz bağlanmamış.',503);const user=await currentMember(request,env);return user?json({user:{id:user.id,email:user.email}}):fail('Oturum açılmamış.',401);}
