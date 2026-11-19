import {reviewByRules,saveRuleReview} from '../../_lib/moderation.js';
import {json,readMemberJson,requireMember,randomId,limited} from '../../_lib/member.js';
import {validateListing,contentHash,moderation,savePhotos,validatePhotoPayloads,reviewListingInBackground,findNearDuplicate,publicItems} from '../../_lib/listings.js';
import {listingError,listingFailure} from '../../_lib/listing-errors.js';
import {notifyListingSubmitted} from '../../_lib/notifications.js';

function decodeListingCursor(value){
  if(!value||value.length>1024||!/^[A-Za-z0-9_-]+$/.test(value))return null;
  try{
    const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
    const item=JSON.parse(atob(padded));
    const tier=Number(item.tier),created_at=Number(item.created_at),id=String(item.id||'');
    if(![0,1,2].includes(tier)||!Number.isSafeInteger(created_at)||created_at<1||!/^[A-Za-z0-9_-]{8,80}$/.test(id))return null;
    return{tier,created_at,id};
  }catch{return null}
}
function encodeListingCursor(item,sortNewest){
  const tier=sortNewest?0:item.package_tier==='premium'?2:item.package_tier==='featured'?1:0;
  return btoa(JSON.stringify({tier,created_at:Number(item.created_at),id:String(item.id)}))
    .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
export async function onRequestGet({request,env}){
  if(!env.DB)return listingError('DB_BINDING_MISSING',request,503);
  try{
    const u=new URL(request.url),rawLimit=u.searchParams.get('limit'),rawCursor=u.searchParams.get('cursor');
    const paged=rawLimit!==null||rawCursor!==null;
    const limit=rawLimit===null?20:Number(rawLimit);
    if(paged&&(!Number.isInteger(limit)||limit<1||limit>50))return listingError('VALIDATION_FAILED',request,400,'limit');
    const cursor=rawCursor===null?null:decodeListingCursor(rawCursor);
    if(rawCursor!==null&&!cursor)return listingError('VALIDATION_FAILED',request,400,'cursor');
    const sort=u.searchParams.get('sort')||'';
    if(sort&&sort!=='newest')return listingError('VALIDATION_FAILED',request,400,'sort');
    const rows=await publicItems(env.DB,{
      q:u.searchParams.get('q'),category:u.searchParams.get('category'),city:u.searchParams.get('city'),
      limit:paged?limit+1:100,cursor,sort,
    });
    if(!paged)return json({items:rows});
    const hasMore=rows.length>limit,items=hasMore?rows.slice(0,limit):rows;
    const next_cursor=hasMore?encodeListingCursor(items[items.length-1],sort==='newest'):null;
    return json({items,next_cursor});
  }catch(error){
    return listingFailure(error,request,'listings-read',503);
  }
}

export async function onRequestPost(context){
  const {request,env}=context;
  if(!env.DB)return listingError('DB_BINDING_MISSING',request,503);
  try{
    const auth=await requireMember(context);
    if(auth.response){
      const status=auth.response.status;
      return listingError(status===401?'AUTH_REQUIRED':status===503?'DB_BINDING_MISSING':'VALIDATION_FAILED',request,status);
    }
    if(await limited(env,request,'listing',8,3600))return listingError('RATE_LIMIT',request,429);
    const data=await readMemberJson(request,7500000);
    const input=data.listing||{};
    const validation=validateListing(input);
    if(validation){
      const code=validation.startsWith('81 ilden')?'CITY_INVALID':'VALIDATION_FAILED';
      const field=code==='CITY_INVALID'?'city':/Kategori/.test(validation)?'category':/Başlık/.test(validation)?'title':/Açıklama/.test(validation)?'description':/İlçe/.test(validation)?'district':/telefon|İletişim/.test(validation)?'contact_phone':/Ücret türü/.test(validation)?'price_unit':/Fiyat|Ücret/.test(validation)?'price_amount':/Adres/.test(validation)?'address':undefined;
      return listingError(code,request,400,field);
    }
    if(data.privacy_ok!==true)return listingError('VALIDATION_FAILED',request,400,'privacy_ok');
    if(typeof data.hp==='string'&&data.hp.trim())return listingError('VALIDATION_FAILED',request,400);
    const photos=data.photos||[];
    try{validatePhotoPayloads(photos)}catch(error){return listingFailure(error,request,'photo-validation',400);}

    const kind=input.category==='operator'?'operator_job':'equipment';
    const item={...input,listing_type:kind,price_amount:kind==='operator_job'||input.price_amount===''?null:(input.price_amount==null?null:Number(input.price_amount))};
    const hash=await contentHash(item);
    const duplicate=await env.DB.prepare("SELECT id FROM listings WHERE content_hash=? AND status<>'deleted' AND created_at>?")
      .bind(hash,Math.floor(Date.now()/1000)-90*86400).first();
    if(duplicate)return listingError('DUPLICATE_LISTING',request,409);

    const near=await findNearDuplicate(env.DB,auth.member.id,item);
    if(near){
      try{
        await env.DB.prepare("INSERT INTO admin_activity(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(NULL,'ai.listing.duplicate_blocked','listing',?,?)")
          .bind(near.id,JSON.stringify({title:String(input.title||'').slice(0,120),city:String(input.city||'').slice(0,80),reason:'Benzer ilan eşleşmesi nedeniyle tekrar ilan gönderimi engellendi.'})).run();
      }catch(error){console.error('[listing-api] duplicate-audit failed',error?.message||error)}
      return listingError('DUPLICATE_LISTING',request,409);
    }

    const date=new Date().toISOString().slice(0,10);
    await env.DB.prepare('INSERT OR IGNORE INTO daily_listing_limits(user_id,usage_date,count) VALUES(?,?,0)').bind(auth.member.id,date).run();
    const quota=await env.DB.prepare('UPDATE daily_listing_limits SET count=count+1 WHERE user_id=? AND usage_date=? AND count<5').bind(auth.member.id,date).run();
    if(!quota.meta?.changes)return listingError('RATE_LIMIT',request,429);

    const rules=await reviewByRules(env.DB,item,auth.member.id),flags=rules.reasons.map(r=>r.reason),status=rules.flagged?'flagged':'pending',id=randomId(16); 
    const insert=await env.DB.prepare('INSERT INTO listings(id,user_id,listing_type,category,category_detail,service_category,title,description,city,district,address,price_amount,price_unit,contact_phone,business_name,status,moderation_note,content_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,auth.member.id,kind,item.category==='mobile_tire'?'tow':item.category==='manlift'?'machine':item.category,item.category==='manlift'?'manlift':null,item.category==='mobile_tire'?'mobile_tire':null,item.title.trim(),item.description.trim(),item.city.trim(),item.district.trim(),String(item.address||'').trim()||null,item.price_amount,item.price_unit==='arayiniz'?'arayiniz':item.price_amount==null?null:String(item.price_unit||'').trim()||null,String(item.contact_phone||'').trim()||null,String(item.business_name||'').trim()||null,status,flags.length?flags.join(' · '):null,hash).run();
    if(!insert.meta?.changes)return listingError('UNKNOWN',request,500);
    try{
      await savePhotos(env.DB,id,photos);
    }catch(error){
      try{await env.DB.prepare('DELETE FROM listings WHERE id=?').bind(id).run()}catch(cleanupError){console.error('[listing-api] photo-cleanup failed',cleanupError?.message||cleanupError)}
      return listingFailure(error,request,'photo-save',400);
    }

    await saveRuleReview(env.DB,id,rules);
    const review=env.DB.prepare("INSERT INTO admin_activity(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(NULL,'ai.listing.review_queued','listing',?,'{}')").bind(id).run();
    const notification=notifyListingSubmitted(env,{id,title:item.title,city:item.city,category:item.category});
    if(context.ctx?.waitUntil){context.ctx.waitUntil(review);context.ctx.waitUntil(notification)}else await Promise.all([review,notification]);
    return json({ok:true,id,status,price_warning:rules.comparison.warning,message:'İlanın incelemeye alındı; yönetici değerlendirmesinden sonra dönüş yapılacak.'},201);
  }catch(error){
    const status=/UNIQUE constraint/i.test(String(error?.message))?409:500;
    return listingFailure(error,request,'listing-create',status);
  }
}
