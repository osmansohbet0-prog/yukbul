function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export async function notifyListingPublished(env, actor, listing) {
  let result='not_configured';
  const recipient=String(env.ADMIN_EMAIL||'').trim();
  const sender=String(env.LISTING_NOTIFICATION_FROM||'').trim();
  if(env.EMAIL&&recipient&&sender) {
    try {
      const title=String(listing.title||'Yeni ilan').slice(0,120);
      const city=String(listing.city||'').slice(0,80);
      const url=`https://yukvinc.com.tr/ilan/${encodeURIComponent(String(listing.id||''))}`;
      await env.EMAIL.send({
        to:recipient,
        from:{email:sender,name:'YükVinç İlan Bildirimi'},
        subject:'YükVinç’te yeni ilan yayında',
        text:`Yeni ilan yönetici onayıyla yayına çıktı.\n\n${title}\n${city}\n${url}`,
        html:`<p>Yeni ilan yönetici onayıyla yayına çıktı.</p><p><strong>${escapeHtml(title)}</strong><br>${escapeHtml(city)}</p><p><a href="${url}">İlanı görüntüle</a></p>`
      });
      result='sent';
    } catch(error) {
      result='failed';
      console.error('[listing-notification]',JSON.stringify({event:'email_failed',code:error?.code||'unknown'}));
    }
  }
  try {
    await env.DB.prepare('INSERT INTO admin_activity(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?)')
      .bind(actor,'listing.published.notification','listing',String(listing.id||''),JSON.stringify({status:result})).run();
  } catch(error) {
    console.error('[listing-notification]',JSON.stringify({event:'audit_failed',code:error?.code||'unknown'}));
  }
  return result;
}

