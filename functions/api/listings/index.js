import {json,readMemberJson,requireMember,randomId,limited} from '../../_lib/member.js';
import {validateListing,contentHash,moderation,savePhotos,validatePhotoPayloads,reviewListingInBackground,findNearDuplicate,publicItems} from '../../_lib/listings.js';
import {listingError,listingFailure} from '../../_lib/listing-errors.js';

export async function onRequestGet({request,env}){
  if(!env.DB)return listingError('DB_BINDING_MISSING',request,503);
  try{
    const u=new URL(request.url);
    const items=await publicItems(env.DB,{q:u.searchParams.get('q'),category:u.searchParams.get('category'),city:u.searchParams.get('city')});
    return json({items});
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
      const field=code==='CITY_INVALID'?'city':/Kategori/.test(validation)?'category':/Başlık/.test(validation)?'title':/Açıklama/.test(validation)?'description':/İlçe/.test(validation)?'district':/telefon|İletişim/.test(validation)?'contact_phone':/Fiyat/.test(validation)?'price_amount':/Adres/.test(validation)?'address':undefined;
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

    const flags=moderation(item),status=flags.length?'flagged':'pending',id=randomId(16);
    const insert=await env.DB.prepare('INSERT INTO listings(id,user_id,listing_type,category,title,description,city,district,address,price_amount,price_unit,contact_phone,status,moderation_note,content_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,auth.member.id,kind,item.category,item.title.trim(),item.description.trim(),item.city.trim(),item.district.trim(),String(item.address||'').trim()||null,item.price_amount,item.price_amount==null?null:String(item.price_unit||'').trim()||null,String(item.contact_phone||'').trim()||null,status,flags.length?flags.join(' · '):null,hash).run();
    if(!insert.meta?.changes)return listingError('UNKNOWN',request,500);
    try{
      await savePhotos(env.DB,id,photos);
    }catch(error){
      try{await env.DB.prepare('DELETE FROM listings WHERE id=?').bind(id).run()}catch(cleanupError){console.error('[listing-api] photo-cleanup failed',cleanupError?.message||cleanupError)}
      return listingFailure(error,request,'photo-save',400);
    }

    const review=reviewListingInBackground(env,id,auth.member.id,item);
    if(context.ctx?.waitUntil)context.ctx.waitUntil(review);else await review;
    return json({ok:true,id,status,message:status==='flagged'?'İlan şüpheli içerik nedeniyle yönetici incelemesine alındı.':'İlanın yönetici onayından sonra yayınlanacak.'},201);
  }catch(error){
    const status=/UNIQUE constraint/i.test(String(error?.message))?409:500;
    return listingFailure(error,request,'listing-create',status);
  }
}
