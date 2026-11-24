import {iconTags,categoryPaths,categoryNames} from '../_lib/discovery.js';
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

function expiredListingPage(canonical) {
  const plans = '<ul><li>Standart — 599 TL / 30 gün</li><li>Öne Çıkan — 2.899 TL / 30 gün</li><li>Premium — 3.000 TL / 30 gün</li></ul>';
  const html = '<!doctype html><html lang="tr"><head>' + iconTags +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,follow"><title>İlan süresi doldu | YükVinç</title>' +
    '<meta name="description" content="Bu ilanın yayın süresi sona erdi. İlan sahibi Hesabım bölümünden yenileme seçeneklerini görebilir.">' +
    '<link rel="canonical" href="' + esc(canonical) + '"><link rel="stylesheet" href="/assets/site.css"></head><body>' +
    '<header><div class="nav wrap"><a class="brand" href="/">YükVinç</a><a class="post-btn" href="/ilan-ver/">İlan ver</a></div></header>' +
    '<main class="wrap section narrow"><p class="eyebrow">İlan durumu</p><h1>Bu ilanın yayın süresi doldu</h1>' +
    '<p class="lead">İlan 30 günlük yayın süresinin ardından askıya alındı. İlan kaydı ve bu adres korunuyor; yeniden yayınlamak için Hesabım bölümünden bir paket seçebilirsin.</p>' +
    '<h2>Yenileme seçenekleri</h2>' + plans +
    '<p><a class="button" href="/hesabim/">Hesabımda yenileme seçeneklerini gör</a></p>' +
    '<p><a class="button secondary" href="/">Tüm ilanlara dön</a></p></main>' +
    '<script src="/assets/sidebar.js" defer></script></body></html>';
  return new Response(html, { status: 200, headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store, max-age=0',
    'x-robots-tag': 'noindex, follow',
    'x-content-type-options': 'nosniff'
  } });
}

export async function onRequestGet({ params, env, request }) {
  if (!env.DB) return new Response('İlan bulunamadı', { status: 404 });
  const id = String(params.id || '');

  try {
    const item = await env.DB.prepare(
      "SELECT id,(SELECT source FROM listing_directory directory_public WHERE directory_public.listing_id=listings.id) AS public_source,listing_type,COALESCE(service_category,category_detail,category) AS category,title,description,city,district,price_amount,price_unit,contact_phone,created_at,updated_at,(SELECT id FROM listing_photos p WHERE p.listing_id=listings.id ORDER BY sort_order LIMIT 1) photo_id FROM listings WHERE id=? AND status='approved' AND (category='operator' OR EXISTS(SELECT 1 FROM users u WHERE u.id=listings.user_id AND u.role='admin') OR trial_expires_at>unixepoch() OR paid_until>unixepoch())"
    ).bind(id).first();

    if (!item) {
      const expired = await env.DB.prepare(
        "SELECT l.id FROM listings l JOIN users u ON u.id=l.user_id WHERE l.id=? AND l.status='approved' AND COALESCE(l.service_category,l.category_detail,l.category)<>'operator' AND u.role<>'admin' AND MAX(COALESCE(l.trial_expires_at,0),COALESCE(l.paid_until,0))<=unixepoch()"
      ).bind(id).first();
      if (expired) {
        const canonical = new URL(request?.url || 'https://yukvinc.com.tr/ilan/' + encodeURIComponent(id) + '/', 'https://yukvinc.com.tr');
        canonical.hostname = 'yukvinc.com.tr';
        canonical.protocol = 'https:';
        canonical.search = '';
        canonical.hash = '';
        return expiredListingPage(canonical.toString());
      }
      return new Response('İlan bulunamadı', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }

    const canonical = 'https://yukvinc.com.tr/ilan/' + encodeURIComponent(id) + '/' + slugify(item.title) + '/';
    if (params.slug !== slugify(item.title)) return Response.redirect(canonical, 301);

    const area = [item.district, item.city].filter(Boolean).join(' / ');
    const categoryLabel = {
      crane: 'kiralık vinç',
      mobile_tire: 'mobil lastikçi ve yerinde lastik tamiri',
      tow: 'oto kurtarıcı',
      basket: 'sepetli vinç',
      machine: 'iş makinesi',
      manlift: 'manlift kiralama',
      lift: 'nakliyat asansörü',
      operator: 'operatör iş ilanı'
    }[item.category] || 'ekipman ilanı';
    const title = item.title + ' | ' + area + ' ' + categoryLabel + ' | YükVinç';
    const descriptionText = String(item.description || '').replace(/\s+/g, ' ').trim();
    const description = (area + ' bölgesinde ' + categoryLabel + ': ' + item.title + '. ' + descriptionText).slice(0, 320);
    const url = canonical;
    const photoUrl = item.photo_id
      ? 'https://yukvinc.com.tr/api/listing-photo/' + encodeURIComponent(item.photo_id) + '?v=2'
      : '';
    const priceUnit = item.price_unit === 'sefer' ? 'iş başı' : item.price_unit || '';
    const price = item.price_unit==='arayiniz' ? 'Fiyat için arayınız' : item.price_amount == null
      ? 'Ücret için ilan sahibine danış'
      : new Intl.NumberFormat('tr-TR').format(item.price_amount) + ' ₺' + (priceUnit ? ' / ' + priceUnit : '');
    const type = item.category==='mobile_tire'?'Yerinde lastik tamiri hizmeti':item.listing_type === 'operator_job' ? 'İş arayan operatör' : 'Ekipman kiralama';
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
          isPartOf: { '@type': 'WebSite', '@id': 'https://yukvinc.com.tr/#website', name: 'YükVinç', url: 'https://yukvinc.com.tr/' },
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
      : (item.public_source&&item.public_source!=='owner'?'<div class="seo-list-photo-placeholder" aria-label="Hizmet kategori simgesi">⚙ '+esc(categoryLabel)+'</div>':'');

    const categoryPath = categoryPaths[item.category];
    const related = '<nav aria-label="İlgili ilanlar">' + (item.city ? '<a href="'+esc(cityUrl)+'">'+esc(item.city)+' ilanları</a> · ' : '') + (categoryPath ? '<a href="/kategori/'+categoryPath+'/">'+esc(categoryNames[item.category])+'</a>' : '') + '</nav>';
    const html = '<!doctype html><html lang="tr"><head>' +
      iconTags + '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="robots" content="index,follow,max-image-preview:large">' +
      '<title>' + esc(title) + '</title><meta name="description" content="' + esc(description) + '">' +
      '<link rel="canonical" href="' + esc(url) + '">' +
      '<meta property="og:type" content="website"><meta property="og:site_name" content="YükVinç">' +
      '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(description) + '">' +
      '<meta property="og:url" content="' + esc(url) + '">' + photoMeta +
      '<link rel="stylesheet" href="/assets/site.css">' +
      '<script type="application/ld+json">' + jsonLd + '</script></head><body>' +
      '<header><div class="nav wrap"><a class="brand" href="/">YükVinç</a><a class="post-btn" href="/ilan-ver/">İlan ver</a></div></header>' +
      '<main class="wrap section narrow"><p class="eyebrow">' + esc(type) + ' · ' + esc(area) + '</p>' +
      related + '<h1>' + esc(item.title) + '</h1><p class="lead">' + esc(item.description || '') + '</p>' +
      (item.public_source&&item.public_source!=='owner'?'<p class="directory-notice">Firma bilgileri kamuya açık kaynaklardan derlenmiştir. Düzeltme veya kaldırma için iletişime geçin. <a href="/iletisim/">İletişim</a></p>':'')+'<p><strong>' + esc(price) + '</strong></p>' + photoHtml +
      (item.contact_phone && /^[+0-9 ()-]{7,20}$/.test(item.contact_phone)
        ? '<p><a class="button" data-metric="phone" href="/api/listings/' + esc(encodeURIComponent(item.id)) + '?contact=call" aria-label="İlan sahibini ara">Ara</a></p>'
        : '<p>Bu ilanda telefon paylaşılmamış.</p>') +
      (item.contact_phone?'<p><a class="button secondary" data-metric="whatsapp" rel="noopener" href="/api/listings/'+esc(encodeURIComponent(item.id))+'?contact=whatsapp">WhatsApp ile iletişime geç</a></p>':'')+'<p>İlanın güncelliğini ve uygunluğunu ilan sahibiyle doğrulayın.</p>' +
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
