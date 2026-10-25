import {json,readMemberJson,requireMember,limited} from '../../_lib/member.js';
import {reviewByRules} from '../../_lib/moderation.js';
export async function onRequestPost(context){
 const auth=await requireMember(context);if(auth.response)return auth.response;
 const day=new Date().toISOString().slice(0,10);await context.env.DB.prepare('INSERT OR IGNORE INTO price_check_limits(user_id,day,count) VALUES(?,?,0)').bind(auth.member.id,day).run();const quota=await context.env.DB.prepare('UPDATE price_check_limits SET count=count+1 WHERE user_id=? AND day=? AND count<60').bind(auth.member.id,day).run();if(!quota.meta?.changes)return json({error:'Karşılaştırma sınırına ulaşıldı.'},429);
 try{const data=await readMemberJson(context.request,6000),x=data.listing;
  if(!x||typeof x.category!=='string'||typeof x.city!=='string'||typeof x.title!=='string'||typeof x.description!=='string'||x.description.length>3000||x.title.length>120||x.city.length>80)return json({error:'İlan alanlarını kontrol et.'},400);
  const result=await reviewByRules(context.env.DB,x,auth.member.id);
  return json({comparison:result.comparison});
 }catch{return json({error:'Fiyat karşılaştırması şu anda yapılamıyor.'},503)}
}
