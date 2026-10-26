import {redactForAI} from './listings.js';

const PUBLIC_ASSISTANT_FILTER="l.status='approved' AND (COALESCE(l.service_category,l.category_detail,l.category)='operator' OR EXISTS(SELECT 1 FROM users u WHERE u.id=l.user_id AND u.role='admin') OR l.trial_expires_at>unixepoch() OR l.paid_until>unixepoch())";

// Assistant searches use canonical equality filters. Do not replace these with LIKE/fuzzy SQL.
export async function assistantPublicItems(db,filters={}){
 let sql=`SELECT l.id,l.listing_type,COALESCE(l.service_category,l.category_detail,l.category) AS category,l.title,l.city,l.district,l.price_amount,l.price_unit,l.contact_phone,l.created_at,l.package_tier,(SELECT id FROM listing_photos p WHERE p.listing_id=l.id ORDER BY sort_order LIMIT 1) AS photo_id FROM listings l WHERE ${PUBLIC_ASSISTANT_FILTER}`;
 const args=[];
 if(filters.category){sql+=' AND COALESCE(l.service_category,l.category_detail,l.category)=?';args.push(filters.category)}
 if(filters.city){sql+=' AND l.city=?';args.push(filters.city)}
 if(filters.district){sql+=' AND l.district=?';args.push(filters.district)}
 if(filters.excludeCity){sql+=' AND l.city<>?';args.push(filters.excludeCity)}
 if(filters.excludeCategory){sql+=' AND COALESCE(l.service_category,l.category_detail,l.category)<>?';args.push(filters.excludeCategory)}
 if(Array.isArray(filters.ids)&&filters.ids.length){const ids=filters.ids.filter(x=>typeof x==='string'&&x.length<=80).slice(0,100);if(!ids.length)return[];sql+=' AND l.id IN ('+ids.map(()=>'?').join(',')+')';args.push(...ids)}
 const limit=Math.max(1,Math.min(100,Number(filters.limit)||30));
 sql+=" ORDER BY CASE l.package_tier WHEN 'premium' THEN 2 WHEN 'featured' THEN 1 ELSE 0 END DESC,l.created_at DESC LIMIT ?";args.push(limit);
 const{results=[]}=await db.prepare(sql).bind(...args).all();
 return results.map(x=>({id:x.id,listing_type:x.listing_type,category:x.category,title:redactForAI(String(x.title||'')).slice(0,120),city:x.city,district:x.district,price_amount:x.price_amount==null?null:Number(x.price_amount),price_unit:x.price_unit,contact_phone:String(x.contact_phone||''),created_at:x.created_at,package_tier:x.package_tier||'standard',photo_url:x.photo_id?`/api/listing-photo/${encodeURIComponent(x.photo_id)}?v=2`:''}));
}
