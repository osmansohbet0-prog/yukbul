import {priceUnitLabel} from '../_lib/price-labels.js';
import {indexableListing} from '../sitemap.xml.js';
import {iconTags,categoryPaths,categoryNames,categoryGuide} from '../_lib/discovery.js';
import {phoneLinks} from '../_lib/phone.js';
import {formatListingTitle} from '../_lib/listings.js';
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
      "SELECT listings.id,(SELECT source FROM listing_directory directory_public WHERE directory_public.listing_id=listings.id) AS public_source,listing_type,LOWER(TRIM(COALESCE(NULLIF(TRIM(service_category),''),NULLIF(TRIM(category_detail),''),TRIM(category)))) AS category,title,description,city,district,price_amount,price_unit,km_price,contact_phone,listings.created_at,listings.updated_at,listings.user_id,listings.business_name,users.display_name,users.company_name,users.profile_bio,users.avatar_updated_at,(SELECT id FROM listing_photos p WHERE p.listing_id=listings.id ORDER BY sort_order LIMIT 1) photo_id FROM listings JOIN users ON users.id=listings.user_id WHERE listings.id=? AND status='approved' AND NOT EXISTS(SELECT 1 FROM listing_directory directory_hidden WHERE directory_hidden.listing_id=listings.id AND directory_hidden.removed_at IS NOT NULL) AND member_paused_at IS NULL AND (LOWER(TRIM(COALESCE(NULLIF(TRIM(service_category),''),NULLIF(TRIM(category_detail),''),TRIM(category))))='operator' OR users.role='admin' OR trial_expires_at>unixepoch() OR paid_until>unixepoch())"
    ).bind(id).first();

    if (!item) return new Response('İlan bulunamadı', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });

    item.title=formatListingTitle(item.title);
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
    const title = item.title + ' - ' + [item.district,item.city].filter(Boolean).join(', ') + ' | YükVinç';
    const descriptionText = String(item.description || '').replace(/\s+/g, ' ').trim();
    const description = (area + ' bölgesinde ' + categoryLabel + ': ' + item.title + '. ' + descriptionText).slice(0, 320);
    const url = canonical;
    const photoUrl = item.photo_id
      ? 'https://yukvinc.com.tr/api/listing-photo/' + encodeURIComponent(item.photo_id) + '?v=2'
      : '';
    const priceUnit = item.price_unit ? priceUnitLabel(item.price_unit) : '';
    const price = item.price_unit==='arayiniz' ? 'Fiyat için arayınız' : item.price_amount == null
      ? 'Ücret için ilan sahibine danış'
      : new Intl.NumberFormat('tr-TR').format(item.price_amount) + ' ₺' + (priceUnit ? ' / ' + priceUnit : '');
    const kmPrice = item.km_price == null ? '' : new Intl.NumberFormat('tr-TR').format(item.km_price) + ' ₺ / km';
    const priceDisplay = price + (kmPrice ? ' + ' + kmPrice : '');
    const type = item.category==='mobile_tire'?'Yerinde lastik tamiri hizmeti':item.listing_type === 'operator_job' ? 'İş arayan operatör' : 'Ekipman kiralama';
    const cityUrl = item.city
      ? 'https://yukvinc.com.tr/sehir/' + encodeURIComponent(slugify(item.city)) + '/'
      : 'https://yukvinc.com.tr/';
    const serviceId=url+'#service';
    const mainEntity=item.listing_type==='operator_job'
      ? {'@type':'Thing','@id':serviceId,name:item.title,description}
      : {
          '@type':'Service',
          '@id':serviceId,
          name:item.title,
          serviceType:categoryLabel,
          description,
          areaServed:(item.district?[{'@type':'AdministrativeArea',name:item.district}]:[]).concat(item.city?[{'@type':'AdministrativeArea',name:item.city}]:[]),
          ...(item.price_amount!=null?{offers:{'@type':'Offer',url,price:Number(item.price_amount),priceCurrency:'TRY',description:'İlan sahibinin bildirdiği '+(priceUnit||'')+' ücret.'+(kmPrice?' Km başı ayrıca '+kmPrice+' uygulanır.':'')}}:{})
        };
    const updatedDate=new Date(Number(item.updated_at||item.created_at)*1000).toLocaleDateString('tr-TR',{dateStyle:'long',timeZone:'Europe/Istanbul'});
    const faqs = [
      { q: `${item.city} ${item.district} bölgesinde bu ${categoryLabel} ilanı nerede geçerli?`, a: `İlan konumu ${area}. Hizmet alanını ve ulaşım koşullarını işlem öncesinde ilan sahibiyle teyit edin.` },
      { q: `${categoryLabel} ücreti nasıl belirleniyor?`, a: `İlanda bildirilen ücret: ${priceDisplay}. Ücrete dahil olan çalışma süresi, yol ve ek masrafları ilan sahibiyle netleştirin.` },
      { q: `${categoryLabel} için nasıl iletişime geçebilirim?`, a: `İlan sahibiyle sayfadaki telefon veya WhatsApp düğmelerinden iletişim kurabilir; müsaitlik ve hizmet ayrıntılarını doğrudan sorabilirsiniz.` }
    ];
    const faqSchema = { '@type':'FAQPage', '@id':url+'#faq', mainEntity:faqs.map(({q,a})=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}})) };
    const ownerName=formatListingTitle(String(item.business_name||item.company_name||item.display_name||'').trim()||'İlan sahibi');
    const ownerProfile=`<aside class="listing-owner" aria-label="İlan sahibi">${item.avatar_updated_at?`<img src="/api/public-member-avatar/${encodeURIComponent(item.user_id)}" alt="${esc(ownerName)} profil fotoğrafı" width="56" height="56" loading="lazy">`:'<span class="owner-avatar owner-avatar-placeholder" aria-hidden="true">👤</span>'}<div><strong>${esc(ownerName)}</strong><span class="verified-owner">✓ Onaylı İlan Sahibi</span>${item.profile_bio?'<p>'+esc(item.profile_bio)+'</p>':''}</div></aside>`;

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
          mainEntity: { '@id': serviceId }
        },
        mainEntity,
        faqSchema,
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
      ? '<img class="detail-photo" src="' + esc(photoUrl) + '" alt="' + esc(item.title + ' — ' + area) + '" width="800" height="600" loading="eager" fetchpriority="high">'
      : (item.public_source&&item.public_source!=='owner'?'<div class="seo-list-photo-placeholder" aria-label="Hizmet kategori simgesi">⚙ '+esc(categoryLabel)+'</div>':'');

    const categoryPath = categoryPaths[item.category];
    const related = '<nav aria-label="İlgili ilanlar">' + (item.city ? '<a href="'+esc(cityUrl)+'">'+esc(item.city)+' ilanları</a> · ' : '') + (categoryPath ? '<a href="/kategori/'+categoryPath+'/">'+esc(categoryNames[item.category])+'</a>' : '') + '</nav>';
    const {results:galleryPhotos=[]}=await env.DB.prepare('SELECT id FROM listing_photos WHERE listing_id=? ORDER BY sort_order LIMIT 10').bind(id).all();
    const galleryUrls=galleryPhotos.map(p=>'https://yukvinc.com.tr/api/listing-photo/'+encodeURIComponent(p.id)+'?v=3');
    if(!galleryUrls.length&&photoUrl)galleryUrls.push(photoUrl);
    const phone=phoneLinks(item.contact_phone);
    const displayPhone=phone?phone.tel.replace("tel:+90","0").replace(/^(0\d{3})(\d{3})(\d{2})(\d{2})$/,"$1 $2 $3 $4"):"";
    const gallery=galleryUrls.length?`<div class="detail-photo-frame"><img class="detail-photo" data-gallery-main src="${esc(galleryUrls[0])}" alt="${esc(item.title)}" width="800" height="600" loading="eager" fetchpriority="high"><button type="button" class="gallery-enlarge" data-gallery-enlarge>Büyüt ↗</button></div><div class="gallery-thumbs" aria-label="İlan fotoğrafları">${galleryUrls.map((src,i)=>`<button type="button" data-gallery-src="${esc(src)}" aria-label="Fotoğraf ${i+1}" aria-pressed="${i===0}"><img src="${esc(src)}&amp;thumb=1" alt="" width="72" height="54" loading="lazy"></button>`).join('')}</div><p class="gallery-count" data-gallery-count>1 / ${galleryUrls.length} fotoğraf</p>`:'<div class="detail-photo-frame"><span class="detail-empty-photo">Fotoğraf eklenmemiş</span></div>';
    const facts=[['Kategori',categoryLabel],['Hizmet',type],['Konum',area],...(item.price_amount!=null||item.price_unit?[['Ücret',price]]:[]),...(item.price_unit?[['Ücret türü',priceUnit]]:[]),...(item.km_price!=null?[['Km başı ücret',kmPrice]]:[]),['Güncelleme',updatedDate]].filter(([,value])=>value);
    const avatar=item.avatar_updated_at?`<img class="detail-seller-avatar" src="/api/public-member-avatar/${encodeURIComponent(item.user_id)}" alt="${esc(ownerName)}">`:`<span class="detail-seller-avatar" aria-hidden="true">${esc(ownerName.slice(0,1).toLocaleUpperCase('tr'))}</span>`;
    const html=`<!doctype html><html lang="tr"><head>${iconTags}<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${indexableListing(item)?'index,follow,max-image-preview:large':'noindex,follow'}"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="website"><meta property="og:site_name" content="YükVinç"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}">${photoMeta}<link rel="stylesheet" href="/assets/site.css"><link rel="stylesheet" href="/assets/detail-clean.css?v=20261029clean2"><script type="application/ld+json">${jsonLd}</script></head><body><header><div class="nav wrap"><a class="brand" href="/">YükVinç</a><a class="post-btn" href="/ilan-ver/">İlan ver</a></div></header><main class="listing-detail"><nav class="detail-breadcrumb" aria-label="Gezinti"><a href="/">İlanlar</a><span>›</span><a href="/kategori/${esc(categoryPath||'vinc')}/">${esc(categoryLabel)}</a><span>›</span><a href="${esc(cityUrl)}">${esc(item.city)}</a></nav><h1 class="detail-title">${esc(item.title)}</h1><p class="detail-location">${esc(area)}</p><div class="detail-grid"><section class="detail-gallery" aria-label="Fotoğraflar">${gallery}</section><aside class="detail-contact" aria-label="İlan sahibi ve iletişim"><div class="detail-price">${esc(price)}${kmPrice?'<small>+ '+esc(kmPrice)+'</small>':''}</div><div class="detail-seller">${avatar}<div><strong>${esc(ownerName)}</strong><small>İlan sahibi</small>${phone?'<small class="seller-phone">'+esc(displayPhone)+'</small>':''}</div></div>${item.profile_bio?'<p class="seller-bio">'+esc(item.profile_bio)+'</p>':''}<div class="contact-actions-row">${phone?`<a class="contact-call" data-metric="phone" href="${phone.tel}" aria-label="İlan sahibini ara">Telefonla ara</a><a class="contact-whatsapp" data-metric="whatsapp" href="${phone.whatsapp}" rel="noopener">WhatsApp</a>`:'<p>Telefon paylaşılmamış.</p>'}</div><p class="detail-contact-note">Müsaitlik ve hizmet ayrıntıları için ilan sahibiyle görüş.</p></aside><section class="detail-content"><h2>İlan bilgileri</h2><dl class="detail-facts">${facts.map(([name,value])=>'<div><dt>'+esc(name)+'</dt><dd>'+esc(value)+'</dd></div>').join('')}</dl><h2>Açıklama</h2><p class="detail-description">${esc(item.description||'')}</p><section aria-label="Sıkça sorulan sorular"><h2>Sıkça sorulan sorular</h2>${faqs.map(({q,a})=>'<details><summary>'+esc(q)+'</summary><p>'+esc(a)+'</p></details>').join('')}</section></section></div><div class="detail-report"><a href="/">← Tüm ilanlar</a><details><summary>İlanı bildir</summary><form id="report-form"><label>Bildirim sebebi<textarea name="reason" minlength="5" maxlength="300" required></textarea></label><button class="reset-btn" type="submit">Gönder</button><p id="report-status" role="status"></p></form></details></div>${item.public_source&&item.public_source!=='owner'?'<details class="detail-source-note"><summary>Firma kaydı hakkında</summary><p>Firma bilgileri kamuya açık kaynaklardan derlenmiştir. Düzeltme veya kaldırma için <a href="/iletisim/">iletişime geçin.</a></p></details>':''}</main><dialog class="photo-dialog" id="photo-dialog" aria-label="Fotoğrafı büyüt"><button type="button" aria-label="Fotoğrafı kapat">Kapat ×</button><img alt=""></dialog><script src="/assets/detail-gallery.js" defer></script><script src="/assets/detail.js?v=20261029photo10" defer></script><script src="/assets/sidebar.js" defer></script></body></html>`;

    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  } catch (error) {
    console.error('[listing-page]',error?.message||'Error');
    return new Response('İlan bulunamadı', { status: 404 });
  }
}

