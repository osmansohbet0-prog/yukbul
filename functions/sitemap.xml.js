const base = 'https://yukvinc.com.tr';
const slug = (value) => String(value || '')
  .toLocaleLowerCase('tr')
  .replace(/ı/g, 'i')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80)
  .replace(/-+$/g, '') || 'ilan';
const xml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
}[char]));

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return new Response('Sitemap geçici olarak oluşturulamıyor.', {
      status: 503,
      headers: { 'cache-control': 'no-store', 'retry-after': '300' }
    });
  }

  try {
    const { results = [] } = await env.DB.prepare(
      "SELECT id,title,category,city,district,updated_at,(SELECT id FROM listing_photos p WHERE p.listing_id=listings.id ORDER BY sort_order LIMIT 1) photo_id FROM listings WHERE status='approved' AND (category='operator' OR EXISTS(SELECT 1 FROM users u WHERE u.id=listings.user_id AND u.role='admin') OR trial_expires_at>unixepoch() OR paid_until>unixepoch()) ORDER BY updated_at DESC LIMIT 45000"
    ).all();

    const today = new Date().toISOString().slice(0, 10);
    const urls = new Map([
      ['/', { lastmod: today }],
      ['/iletisim/', { lastmod: today }],
      ['/gizlilik/', { lastmod: today }]
    ]);

    for (const item of results) {
      const date = new Date(Number(item.updated_at) * 1000).toISOString().slice(0, 10);
      const image = item.photo_id
        ? base + '/api/listing-photo/' + encodeURIComponent(item.photo_id) + '?v=2'
        : '';
      urls.set('/ilan/' + encodeURIComponent(item.id) + '/' + slug(item.title) + '/', { lastmod: date, image });

      const city = slug(item.city);
      if (item.city) urls.set('/sehir/' + encodeURIComponent(city) + '/', { lastmod: date });

      const category = {
        crane: 'vinc',
        tow: 'oto-kurtarici',
        basket: 'sepetli-platform',
        manlift: 'manlift',
        machine: 'is-makinesi',
        lift: 'nakliyat-asansoru',
        operator: 'operator-is-ilanlari'
      }[item.category];
      if (category) urls.set('/kategori/' + category + '/', { lastmod: date });
    }

    const body = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' +
      [...urls].map(([path, entry]) =>
        '<url><loc>' + xml(base + path) + '</loc><lastmod>' + entry.lastmod + '</lastmod>' +
        (entry.image ? '<image:image><image:loc>' + xml(entry.image) + '</image:loc></image:image>' : '') +
        '</url>'
      ).join('') +
      '</urlset>';

    return new Response(body, {
      headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public,max-age=3600' }
    });
  } catch (error) {
    console.error('[sitemap]', JSON.stringify({
      event: 'generation_failed',
      name: error?.name || 'Error',
      message: error?.message || 'unknown'
    }));
    return new Response('Sitemap geçici olarak oluşturulamıyor.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '300' }
    });
  }
}
