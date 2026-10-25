const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));
const slugify = (value) => String(value || '')
  .toLocaleLowerCase('tr')
  .replace(/ı/g, 'i')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80)
  .replace(/-+$/g, '') || 'ilan';

export async function onRequestGet({ params, env }) {
  if (!env.DB) return new Response('İlan bulunamadı', { status: 404 });
  const id = String(params.id || '');

  try {
    const item = await env.DB.prepare(
      "SELECT id,listing_type,COALESCE(category_detail,category) AS category,title,description,city,district,price_amount,price_unit,contact_phone,created_at,updated_at,(SELECT id FROM listing_photos p WHERE p.listing_id=listings.id ORDER BY sort_order LIMIT 1) photo_id FROM listings WHERE id=? AND status='approved' AND (category='operator' OR EXISTS(SELECT 1 FROM users u WHERE u.id=listings.user_id AND u.role='admin') OR trial_expires_at>unixepoch() OR paid_until>unixepoch())"
    ).bind(id).first();

    if (!item) return new Response('İlan bulunamadı', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });

    const canonical = 'https://yukvinc.com.tr/ilan/' + encodeURIComponent(id) + '/' + slugify(item.title) + '/';
    if (!params.slug) return Response.redirect(canonical, 301);

    const area = [item.district, item.city].filter(Boolean).join(' / ');
    const categoryLabel = {
      crane: 'kiralık vinç',
      tow: 'oto kurtarıcı',
      basket: 'sepetli vinç',
      machine: 'iş makinesi',
      manlift: 'manlift kiralama',
      lift: 'nakliyat asansörü',
      operator: 'operatör iş ilanı'
    }[item.category] || 'ekipman ilanı';
    const title = item.title + ' | ' + area + ' ' + categoryLabel + ' | Yük Vinç';
    const descriptionText = String(item.description || '').replace(/\s+/g, ' ').trim();
    const description = (area + ' bölgesinde ' + categoryLabel + ': ' + item.title + '. ' + descriptionText).slice(0, 320);
    const url = canonical;
    const photoUrl = item.photo_id
      ? 'https://yukvinc.com.tr/api/listing-photo/' + encodeURIComponent(item.photo_id) + '?v=2'
      : '';
    const priceUnit = item.price_unit === 'sefer' ? 'iş başı' : item.price_unit || '';
    const price = item.price_amount == null
      ? 'Ücret için ilan sahibine danış'
      : new Intl.NumberFormat('tr-TR').format(item.price_amount) + ' ₺' + (priceUnit ? ' / ' + priceUnit : '');
    const type = item.listing_type === 'operator_job' ? 'İş arayan operatör' : 'Ekipman kiralama';
    const cityUrl = item.city
      ? 'https://yukvinc.com.tr/sehir/' + encodeURIComponent(slugify(item.city)) + '/'
      : 'https://yukvinc.com.tr/';

    const structured = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': url + '#webpage',
          name: title,
          description,
          url,
          inLanguage: 'tr-TR',
          datePublished: new Date(Number(item.created_at) * 1000).toISOString(),
          dateModified: new Date(Number(item.updated_at || item.created_at) * 1000).toISOString(),
          isPartOf: { '@type': 'WebSite', '@id': 'https://yukvinc.com.tr/#website', name: 'Yük Vinç', url: 'https://yukvinc.com.tr/' },
          breadcrumb: { '@id': url + '#breadcrumb' },
          ...(photoUrl ? { primaryImageOfPage: { '@type': 'ImageObject', url: photoUrl, caption: item.title } } : {}),
          mainEntity: { '@type': 'Thing', name: item.title, description }
        },
        {
          '@type': 'BreadcrumbList',
          '@id': url + '#breadcrumb',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: 'https://yukvinc.com.tr/' },
            ...(item.city ? [{ '@type': 'ListItem', position: 2, name: item.city, item: cityUrl }] : []),
            { '@type': 'ListItem', position: item.city ? 3 : 2, name: item.title, item: url }
          ]
        }
      ]
    };

    const jsonLd = JSON.stringify(structured).replace(/</g, '\\u003c');
    const photoMeta = photoUrl
      ? '<meta property="og:image" content="' + esc(photoUrl) + '"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="' + esc(photoUrl) + '">'
      : '<meta name="twitter:card" content="summary">';
    const photoHtml = photoUrl
      ? '<img class="detail-photo" src="' + esc(photoUrl) + '" alt="' + esc(item.title + ' — ' + area) + '" loading="eager">'
      : '';

    const html = '<!doctype html><html lang="tr"><head>' +
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="robots" content="index,follow,max-image-preview:large">' +
      '<title>' + esc(title) + '</title><meta name="description" content="' + esc(description) + '">' +
      '<link rel="canonical" href="' + esc(url) + '">' +
      '<meta property="og:type" content="website"><meta property="og:site_name" content="Yük Vinç">' +
      '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(description) + '">' +
      '<meta property="og:url" content="' + esc(url) + '">' + photoMeta +
      '<link rel="stylesheet" href="/assets/site.css">' +
      '<script type="application/ld+json">' + jsonLd + '</script></head><body>' +
      '<header><div class="nav wrap"><a class="brand" href="/">Yük Vinç</a><a class="post-btn" href="/ilan-ver/">İlan ver</a></div></header>' +
      '<main class="wrap section narrow"><p class="eyebrow">' + esc(type) + ' · ' + esc(area) + '</p>' +
      '<h1>' + esc(item.title) + '</h1><p class="lead">' + esc(item.description || '') + '</p>' +
      '<p><strong>' + esc(price) + '</strong></p>' + photoHtml +
      (item.contact_phone && /^[+0-9 ()-]{7,20}$/.test(item.contact_phone)
        ? '<p><a class="button" href="tel:' + esc(item.contact_phone.replace(/[^+0-9]/g, '')) + '">İlan sahibini ara</a></p>'
        : '<p>Bu ilanda telefon paylaşılmamış.</p>') +
      '<p>İlanın güncelliğini ve uygunluğunu ilan sahibiyle doğrulayın.</p>' +
      '<p><a class="button secondary" href="/">Tüm ilanlara dön</a></p>' +
      '<details><summary>Şikayet et</summary><form id="report-form">' +
      '<label>Şikayet sebebi<textarea name="reason" minlength="5" maxlength="300" required></textarea></label>' +
      '<button class="reset-btn" type="submit">Yöneticiye bildir</button><p id="report-status" role="status"></p>' +
      '</form></details></main><script src="/assets/detail.js" defer></script><script src="/assets/sidebar.js" defer></script></body></html>';

    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60', 'x-content-type-options': 'nosniff' }
    });
  } catch {
    return new Response('İlan bulunamadı', { status: 404 });
  }
}
