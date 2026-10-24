function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function sendAdminEmail(env,{action,subject,text,html,listingId,actor=null}) {
  let result='not_configured';
  const recipient=String(env.ADMIN_EMAIL||'').trim();
  const sender=String(env.LISTING_NOTIFICATION_FROM||'').trim();
  if(env.EMAIL&&recipient&&sender) {
    try { await env.EMAIL.send({to:recipient,from:{email:sender,name:'YükVinç · YükUsta'},subject,text,html}); result='sent'; }
    catch(error) { result='failed'; console.error('[listing-notification]',JSON.stringify({event:'email_failed',code:error?.code||'unknown'})); }
  }
  try { await env.DB.prepare('INSERT INTO admin_activity(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?)').bind(actor,action,'listing',String(listingId||''),JSON.stringify({status:result})).run(); }
  catch(error) { console.error('[listing-notification]',JSON.stringify({event:'audit_failed',code:error?.code||'unknown'})); }
  return result;
}

export async function notifyListingSubmitted(env,listing) {
  const title=String(listing.title||'Yeni ilan').slice(0,120),city=String(listing.city||'').slice(0,80),url=`https://yukvinc.com.tr/ilan/${encodeURIComponent(String(listing.id||''))}`;
  return sendAdminEmail(env,{
    action:'listing.submitted.notification',listingId:listing.id,
    subject:'YükVinç’te yeni ilan inceleme bekliyor',
    text:`Yeni ilan gönderildi. YükUsta arka planda metin, fotoğraf ve fiyat kontrollerini yapacak; güvenli otomatik yayın seçeneği açıksa 30 dakika sonra yeniden değerlendirecek.\n\n${title}\n${city}\n${url}`,
    html:`<p>Yeni ilan gönderildi. YükUsta metin, fotoğraf ve fiyat kontrollerini yapacak; otomatik yayın seçeneği açıksa 30 dakika sonra yeniden değerlendirecek.</p><p><strong>${escapeHtml(title)}</strong><br>${escapeHtml(city)}</p><p><a href="${url}">İlanı incele</a></p>`
  });
}

export async function notifyListingPublished(env,actor,listing) {
  const ai=actor==='ai',title=String(listing.title||'Yeni ilan').slice(0,120),city=String(listing.city||'').slice(0,80),url=`https://yukvinc.com.tr/ilan/${encodeURIComponent(String(listing.id||''))}`;
  const comparison=String(listing.agent_summary||''),state=ai?'YükUsta ön incelemeyi tamamladı ve ilanı yayına aldı. Yönetici incelemesi panelde bekliyor.':'Yeni ilan yönetici onayıyla yayına çıktı.';
  return sendAdminEmail(env,{
    action:ai?'ai.listing.auto_published.notification':'listing.published.notification',listingId:listing.id,actor:ai?null:actor||null,
    subject:ai?'YükUsta ön incelemesi: ilan yayında, yönetici kontrolü bekliyor':'YükVinç’te yeni ilan yayında',
    text:`${state}\n\n${title}\n${city}${comparison?'\nFiyat karşılaştırması: '+comparison:''}\n${url}`,
    html:`<p>${escapeHtml(state)}</p><p><strong>${escapeHtml(title)}</strong><br>${escapeHtml(city)}</p>${comparison?`<p>Fiyat karşılaştırması: ${escapeHtml(comparison)}</p>`:''}<p><a href="${url}">İlanı görüntüle</a></p>`
  });
}

export async function notifyListingReview(env,listing){
 const title=String(listing.title||'İlan').slice(0,120),reason=String(listing.reason||'İlanı ve fotoğrafları inceleyin.').slice(0,500);
 return sendAdminEmail(env,{action:'ai.listing.review_notification',listingId:listing.id,subject:'YükUsta uyarısı: ilan ve fotoğraf incelemesi gerekli',text:title+'\n'+reason+'\nhttps://yukvinc.com.tr/admin/',html:'<p><strong>'+escapeHtml(title)+'</strong></p><p>'+escapeHtml(reason)+'</p><p><a href="https://yukvinc.com.tr/admin/">Yönetim panelinde incele</a></p>'});
}
