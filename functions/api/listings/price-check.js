import {json,readMemberJson,requireMember,limited} from '../../_lib/member.js';
import {reviewByRules} from '../../_lib/moderation.js';
export async function onRequestPost(context){
 const auth=await requireMember(context);if(auth.response)return auth.response;
 if(await limited(context.env,context.request,'listing',30,3600))return json({error:'Karşılaştırma sınırına ulaşıldı.'},429);
 try{const data=await readMemberJson(context.request,6000),x=data.listing;
  if(!x||typeof x.category!=='string'||typeof x.city!=='string'||typeof x.title!=='string'||typeof x.description!=='string'||x.description.length>3000||x.title.length>120||x.city.length>80)return json({error:'İlan alanlarını kontrol et.'},400);
  const result=await reviewByRules(context.env.DB,x,auth.member.id);
  return json({comparison:result.comparison});
 }catch{return json({error:'Fiyat karşılaştırması şu anda yapılamıyor.'},503)}
}
