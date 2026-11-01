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
    text:`Yeni ilan gönderildi. YükUsta arka planda metin, fotoğraf ve fiyat kontrollerini yapacak; yayın kararını yalnızca yönetici verecek.\n\n${title}\n${city}\n${url}`,
    html:`<p>Yeni ilan gönderildi. YükUsta metin, fotoğraf ve fiyat kontrollerini yapacak; yayın kararını yalnızca yönetici verecek.</p><p><strong>${escapeHtml(title)}</strong><br>${escapeHtml(city)}</p><p><a href="${url}">İlanı incele</a></p>`
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

// One transactional message per approved listing; never sends to an unverified address.
export async function queueOwnerPublicationEmail(env,listingId){
 try{return await env.DB.prepare("INSERT OR IGNORE INTO publication_email_outbox(listing_id,user_id) SELECT l.id,u.id FROM listings l JOIN users u ON u.id=l.user_id WHERE l.id=? AND l.status='approved' AND l.member_paused_at IS NULL AND u.active=1 AND u.email_verified_at IS NOT NULL AND u.email_notifications=1").bind(listingId).run()}catch(error){console.error('[owner-publication-email]',JSON.stringify({event:'queue_failed',code:error?.code||'unknown'}));return null}
}

export async function processPublicationEmails(env){
 if(!env.EMAIL||!String(env.LISTING_NOTIFICATION_FROM||'').trim()||!env.DB)return 0;
 const now=Math.floor(Date.now()/1000);await env.DB.prepare("UPDATE publication_email_outbox SET status='queued',lease_until=NULL,next_attempt_at=? WHERE status='sending' AND lease_until<?").bind(now,now).run();const {results=[]}=await env.DB.prepare("SELECT o.listing_id,o.user_id,o.attempts,u.email,l.title,l.city FROM publication_email_outbox o JOIN users u ON u.id=o.user_id JOIN listings l ON l.id=o.listing_id WHERE o.status='queued' AND o.next_attempt_at<=? AND l.status='approved' AND l.member_paused_at IS NULL AND u.active=1 AND u.email_verified_at IS NOT NULL AND u.email_notifications=1 AND (SELECT COUNT(*) FROM publication_email_outbox o2 WHERE o2.user_id=o.user_id AND o2.status='sent' AND o2.sent_at>?)<5 ORDER BY o.created_at LIMIT 5").bind(now,now-86400).all();
 for(const row of results){const lease=await env.DB.prepare("UPDATE publication_email_outbox SET status='sending',lease_until=? WHERE listing_id=? AND status='queued'").bind(now+120,row.listing_id).run();if(!Number(lease.meta?.changes||0))continue;const title=String(row.title||'İlan').slice(0,120),city=String(row.city||'').slice(0,80),link=`https://yukvinc.com.tr/ilan/${encodeURIComponent(row.listing_id)}`;try{await env.EMAIL.send({to:row.email,from:{email:String(env.LISTING_NOTIFICATION_FROM).trim(),name:'YükVinç'},subject:'İlanın YükVinç’te yayında',text:`İlanın yönetici incelemesinden geçti ve yayına alındı.\n\n${title}\n${city}\n${link}`,html:`<p>İlanın yönetici incelemesinden geçti ve yayına alındı.</p><p><strong>${escapeHtml(title)}</strong><br>${escapeHtml(city)}</p><p><a href="${link}">İlanını görüntüle</a></p>`});await env.DB.prepare("UPDATE publication_email_outbox SET status='sent',attempts=attempts+1,sent_at=?,lease_until=NULL,last_error_code=NULL WHERE listing_id=? AND status='sending'").bind(now,row.listing_id).run()}catch(error){const attempts=Number(row.attempts||0)+1;await env.DB.prepare("UPDATE publication_email_outbox SET attempts=?,next_attempt_at=?,status=?,lease_until=NULL,last_error_code=? WHERE listing_id=? AND status='sending'").bind(attempts,now+Math.min(3600,60*2**attempts),attempts>=4?'failed':'queued',String(error?.code||error?.name||'send_failed').slice(0,50),row.listing_id).run();console.error('[owner-publication-email]',JSON.stringify({event:'send_failed',code:error?.code||'unknown',attempts}))}}
 return results.length;
}

