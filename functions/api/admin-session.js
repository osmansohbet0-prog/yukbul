import {json,fail,requireAdmin} from '../_lib/core.js';
export async function onRequestGet(context) {try{const a=await requireAdmin(context);return a.response||json({user:{email:a.admin.email}});}catch{return fail('Oturum kontrol edilemedi.',503);}}
