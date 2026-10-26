import {json,fail,isAllowedOrigin,readJson} from '../../_lib/core.js';
import {limited} from '../../_lib/member.js';
import {assistantPublicItems} from '../../_lib/assistant-listings.js';
import {validateToolCall,rankNearby} from '../../_lib/agent-tools.js';
export async function onRequestPost({request,env}){
 if(!isAllowedOrigin(request))return fail('İstek kaynağı doğrulanamadı.',403);
 if(!env.DB)return fail('Arama şu anda kullanılamıyor.',503);
 try{const point=await readJson(request,512);if(!validateToolCall('nearby_search',point))return fail('Konum verisi geçersiz.');
 if(await limited(env,request,'ai',10,900))return fail('Lütfen bir süre sonra tekrar arayın.',429);
 const{results:coordinates=[]}=await env.DB.prepare("SELECT g.listing_id,g.latitude,g.longitude FROM listing_locations g JOIN listings l ON l.id=g.listing_id WHERE l.status='approved' AND g.verified_by IS NOT NULL AND (COALESCE(l.service_category,l.category_detail,l.category)='operator' OR EXISTS(SELECT 1 FROM users u WHERE u.id=l.user_id AND u.role='admin') OR l.trial_expires_at>unixepoch() OR l.paid_until>unixepoch()) LIMIT 1000").all();
 const closest=rankNearby(coordinates.map(x=>({...x,id:x.listing_id})),point,point.radius_km||100).slice(0,100),ids=closest.map(x=>x.id);
 const publicItems=await assistantPublicItems(env.DB,{ids,limit:100}),byId=new Map(publicItems.map(x=>[x.id,x]));
 const items=closest.map(x=>{const item=byId.get(x.id);return item?{...item,distance_km:x.distance_km}:null}).filter(Boolean).slice(0,3);
 // Coordinates never enter logs, conversations, audit metadata or model inputs.
 return json({items,message:items.length?'Doğrulanmış ilan konumlarına göre yaklaşık mesafe.':'Bu mesafede doğrulanmış konumu olan yayındaki ilan bulunamadı. İl/ilçe filtresini kullanabilirsin.'});
 }catch{return fail('Konuma göre arama yapılamadı. İl ve ilçe filtresini kullanabilirsin.',503)}
}

