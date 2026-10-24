import {reviewListingInBackground} from './listings.js';
import {readAiModeration} from './ai-settings.js';
import {notifyListingPublished} from './notifications.js';

const now=()=>Math.floor(Date.now()/1000);
async function audit(db,action,id,metadata){
  try{await db.prepare('INSERT INTO admin_activity(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(NULL,?,?,?,?)').bind(action,'listing',id,JSON.stringify(metadata)).run()}
  catch(error){console.error('[listing-agent]',JSON.stringify({event:'audit_failed',action,name:error?.name||'Error'}))}
}
async function holdOnce(db,id,reason){
  const old=await db.prepare("SELECT id FROM admin_activity WHERE action='ai.listing.auto_hold' AND entity_type='listing' AND entity_id=? LIMIT 1").bind(id).first();
  if(!old)await audit(db,'ai.listing.auto_hold',id,{reason});
}
async function getPriceComparison(db,listing){
  if(listing.price_amount==null||!Number.isFinite(Number(listing.price_amount)))return{ok:false,reason:'Fiyat girilmedi; fiyat karşılaştırması için yönetici incelemesi gerekli.'};
  const amount=Number(listing.price_amount);
  if(amount<500)return{ok:false,flag:true,reason:'Fiyat 500 TL alt sınırının altında.'};
  const {results=[]}=await db.prepare("SELECT price_amount FROM listings WHERE status='approved' AND category=? AND city=? AND COALESCE(price_unit,'')=COALESCE(?,'') AND price_amount IS NOT NULL AND price_amount>=500 AND (user_id IN (SELECT id FROM users WHERE role='admin') OR trial_expires_at>unixepoch() OR paid_until>unixepoch()) ORDER BY created_at DESC LIMIT 101").bind(listing.category,listing.city,listing.price_unit).all();
  const values=results.map(row=>Number(row.price_amount)).filter(value=>Number.isFinite(value)&&value>=500).sort((a,b)=>a-b);
  if(values.length<3)return{ok:false,reason:'Aynı şehir, kategori ve ücret türünde en az 3 yayındaki emsal bulunamadı; fiyatı yönetici karşılaştırsın.'};
  const middle=Math.floor(values.length/2),median=values.length%2?values[middle]:(values[middle-1]+values[middle])/2;
  if(amount<median*.4)return{ok:false,flag:true,reason:'İlan fiyatı benzer ilanların şehir içi ortancasının %40’ından düşük.',count:values.length,median:Math.round(median)};
  if(amount>median*4)return{ok:false,flag:true,reason:'İlan fiyatı benzer ilanların şehir içi ortancasının 4 katından yüksek; tutarı doğrulayın.',count:values.length,median:Math.round(median)};
  return{ok:true,count:values.length,median:Math.round(median),reason:`${values.length} emsalin ortanca ücreti ${Math.round(median).toLocaleString('tr-TR')} TL`};
}
export async function processListingAgent(env){
  const db=env.DB;if(!db||env.AI_ENABLED!=='true'||!env.AI)return{skipped:true,reason:'ai_unavailable'};
  const config=await readAiModeration(db);
  if(!config.enabled)return{skipped:true,reason:'disabled'};
  const {results:unreviewed=[]}=await db.prepare("SELECT l.* FROM listings l WHERE l.status='pending' AND l.created_at>unixepoch()-86400 AND NOT EXISTS(SELECT 1 FROM admin_activity a WHERE a.entity_id=l.id AND a.action IN ('ai.listing.review_completed','ai.listing.image_review_failed') AND a.created_at>=l.updated_at) AND NOT EXISTS(SELECT 1 FROM admin_activity a WHERE a.entity_id=l.id AND a.action='ai.listing.review_started' AND a.created_at>unixepoch()-600) AND (SELECT COUNT(*) FROM admin_activity a WHERE a.entity_id=l.id AND a.action='ai.listing.review_started')<3 ORDER BY l.created_at ASC LIMIT 2").all();
  for(const item of unreviewed)await reviewListingInBackground(env,item.id,item.user_id,item);
  if(!config.auto_publish||!config.image_review)return{skipped:true,reason:'auto_publish_disabled',reviewed:unreviewed.length};
  const cutoff=now()-30*60,{results=[]}=await db.prepare("SELECT l.id,l.user_id,l.title,l.category,l.city,l.district,l.price_amount,l.price_unit,l.created_at,l.updated_at FROM listings l JOIN users u ON u.id=l.user_id WHERE l.status='pending' AND l.created_at<=? AND u.role<>'admin' ORDER BY l.created_at ASC LIMIT 20").bind(cutoff).all();
  let published=0,held=0;
  for(const listing of results)try{
    const review=await db.prepare("SELECT action,metadata_json,created_at FROM admin_activity WHERE entity_type='listing' AND entity_id=? AND action IN ('ai.listing.review_completed','ai.listing.image_review_failed','ai.listing.review_failed','ai.listing.flagged','ai.listing.duplicate_flagged','listing.duplicate_signal_flagged') ORDER BY created_at DESC LIMIT 1").bind(listing.id).first();
    if(!review||review.created_at<Math.max(listing.created_at,listing.updated_at||listing.created_at)||review.action!=='ai.listing.review_completed'){
      held++;await holdOnce(db,listing.id,'YükUsta incelemesi tamamlanmadı veya görsel denetimi başarısız oldu; yönetici incelemesi bekleniyor.');continue;
    }
    let meta={};try{meta=JSON.parse(review.metadata_json||'{}')}catch{}
    if(meta.suspicious||meta.duplicate||Number(meta.images_reviewed)<1||Number(meta.images_failed)>0){
      held++;await holdOnce(db,listing.id,'Şüpheli/tekrar içerik veya tam fotoğraf incelemesi yok; yönetici incelemesi bekleniyor.');continue;
    }
    if(listing.category==='operator'){held++;await holdOnce(db,listing.id,'Operatör iş ilanlarında fiyat karşılaştırması uygulanamıyor; yönetici incelemesi gerekli.');continue}
    const comparison=await getPriceComparison(db,listing);
    if(!comparison.ok){
      held++;
      if(comparison.flag){
        const changed=await db.prepare("UPDATE listings SET status='flagged',moderation_note=?,updated_at=unixepoch() WHERE id=? AND status='pending'").bind(comparison.reason,listing.id).run();
        if(changed.meta?.changes)await audit(db,'ai.listing.price_flagged',listing.id,{reason:comparison.reason,comparable_count:comparison.count||0,median:comparison.median||null});
      }else await holdOnce(db,listing.id,comparison.reason);
      continue;
    }
    const reason='YükUsta ön incelemesi tamamlandı; yönetici incelemesi bekleniyor.';
    const changed=await db.prepare("UPDATE listings SET status='approved',moderation_note=?,updated_at=unixepoch(),trial_expires_at=CASE WHEN category<>'operator' AND user_id NOT IN (SELECT id FROM users WHERE role='admin') THEN COALESCE(trial_expires_at,unixepoch()+2592000) ELSE trial_expires_at END WHERE id=? AND status='pending' AND created_at<=?").bind(reason,listing.id,cutoff).run();
    if(!changed.meta?.changes)continue;
    const summary=`${comparison.count} aynı şehir/kategori/ücret türü emsali; ortanca ${comparison.median.toLocaleString('tr-TR')} TL. Emsal verisi YükVinç’teki yayındaki ilanlardan alınmıştır; genel piyasa tarifesi değildir.`;
    await audit(db,'ai.listing.auto_published',listing.id,{reason,images_reviewed:Number(meta.images_reviewed),comparable_count:comparison.count,median_price:comparison.median,price_unit:listing.price_unit});
    await notifyListingPublished(env,'ai',{id:listing.id,title:listing.title,city:listing.city,agent_summary:summary});published++;
  }catch(error){held++;console.error('[listing-agent]',JSON.stringify({event:'listing_failed',listing_id:listing.id,name:error?.name||'Error'}))}
  return{processed:results.length,published,held};
}
