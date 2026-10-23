# YükVinç — GitHub ve Cloudflare Workers

Bu depo tek bir Cloudflare Worker üzerinden statik siteyi ve eski Pages Functions API rotalarını yayımlar. Marka/canonical alan adı `https://yukvinc.com.tr`; `www.yukvinc.com.tr` otomatik olarak ana alan adına yönlenir. Görünüm korunmuştur. Site; üye girişi, ilan verme, yönetici onayı, görseller, içerik ayarları, şikayetler ve SEO sayfalarını içerir.

## Depodaki dağıtım yapılandırması

`wrangler.jsonc` Workers giriş dosyasını (`src/worker.js`), `public` statik varlıklarını, D1 (`DB`), Workers AI (`AI`), gözlemlenebilirliği ve iki custom domain'i tanımlar. `wrangler` sürümü 4.134 veya sonrası olacak şekilde `package.json` içinde tutulur. Wrangler 4.45 ve sonrasında D1 binding'i kimlik numarası olmadan tanımlandığında veritabanı otomatik oluşturulabilir; adı `yukvinc-db` olarak belirlenmiştir. Bu, önceki Pages kurulumunda kullanılan veritabanını tekrar bulabilmesi içindir.

`functions/` içindeki modüller Pages çalışma zamanında çalıştırılmaz; `src/worker.js` bunları Worker içinden açıkça yönlendirir. API yolları, SEO sayfaları ve `/sitemap.xml` aynı adresleri kullanır. Statik dosyalar `env.ASSETS.fetch()` ile sunulur. `www` yönlendirmesi Worker'da yapılır. Pages'e özel `_routes.json` ve hataya yol açan tam URL'li `_redirects` kaldırılmıştır.

## GitHub ve Workers Builds

Depoda `main` dalına commit geldiğinde Workers Builds yapılandırmanızdaki `npx wrangler deploy` komutu çalışır. Eski sağlayıcı yapılandırma dosyaları ve Pages yönlendirme dosyası repodan kaldırılmıştır. Dağıtımı Cloudflare/GitHub check ekranında izleyin. `wrangler.jsonc` ve giriş kodu, bu komutun kullanacağı tek Worker'ı tanımlar.

## D1 ve SQL migration'ları

D1 otomatik kaynak oluşturma Wrangler 4.45+ ile kullanılabilir; mevcut `yukvinc-db` bulunursa ona bağlanır, yoksa oluşturur. **Worker deploy'u SQL migration dosyalarını kendiliğinden çalıştırmaz.** İlk deployment D1'i oluşturduktan sonra bu tek seferlik işlem gerekir:

1. Cloudflare Dashboard → **Workers & Pages** → **D1 SQL Database** → `yukvinc-db` → **Console**.
2. `migrations/0001_initial.sql` dosyasını açıp içeriğini Console'a yapıştırın ve çalıştırın.
3. `migrations/0002_accounts_marketplace.sql` dosyasını aynı şekilde çalıştırın.
4. Veritabanı daha önce kurulduysa SQL Console’da `PRAGMA table_info(listings);` ve `PRAGMA table_info(listing_photos);` ile `content_hash`, `mime_type`, `byte_size` ve `image_blob` sütunlarını kontrol edin. `0001` tabloları yoksa iki dosyayı sırayla çalıştırın; tablolar var ama bu sütunlar yoksa yalnızca `0002` çalıştırın. Sütunlar zaten varsa migration dosyalarını yeniden çalıştırmayın.

Bu adım, mevcut sabit `npx wrangler deploy` komutuna güvenli ve desteklenen biçimde eklenemiyor: Cloudflare deploy aşaması kaynak kodunu dağıtır, D1 SQL migration'larını çalıştırmaz. D1 veritabanı adı ile `wrangler.jsonc` içindeki `yukvinc-db` aynı olmalı.

İlan fotoğrafları D1'de küçük BLOB olarak saklanır; R2 gerekmez. İlan başına en fazla üç fotoğraf vardır. Kullanım kotaları veya saklama sınırları büyürse ücretli plana geçmeden önce onay alın.

## Gerekli değişkenler ve gizli anahtarlar

Hiçbir parola veya anahtar depoya yazılmamalıdır. Cloudflare Dashboard → **Workers & Pages** → **yukbul** → **Settings** → **Variables and Secrets** ekranında aşağıdakileri Production ortamına ekleyin; Secret türündekileri **Encrypt** olarak kaydedin:

| Ad | Tür | Açıklama |
|---|---|---|
| `TURNSTILE_SITE_KEY` | Text (açık anahtar) | Kayıt/giriş bot doğrulama widget'ı. Turnstile widget'ında `yukvinc.com.tr` ve `www.yukvinc.com.tr` hostname'leri tanımlı olmalı. |
| `TURNSTILE_SECRET` | Secret | Turnstile sunucu doğrulaması. |
| `ADMIN_SECURITY_CODE` | Secret | Yönetici e-posta/şifresine ek güvenlik kodu; en az 8 karakter kullanın. |
| `ADMIN_BOOTSTRAP_SECRET` | Secret, ilk kurulum için | İlk yönetici hesabını oluşturmak için en az 32 karakterli tek kullanımlık gizli değer. Hesap oluşturulunca kaldırın. |

Adımlar: **Add variable** → değişken adını yazın → değerini girin → Secret için **Encrypt** seçin → **Save**. Site key gizli değildir, diğer üç değer gizlidir. Anahtar değerlerini bana veya GitHub'a göndermeyin. `AI_ENABLED` yapılandırmada `false` olarak kalır; böylece AI çağrısı yapılmaz. Workers AI'ı açmak isteğe bağlıdır; hesabınızın ücretsiz kullanımını doğrulamadan veya ücret gerekirse onay almadan etkinleştirmeyin.

## İlk yönetici ve panel

1. Secret'ları kaydedip Worker dağıtıldıktan ve D1 migration'ları tamamlandıktan sonra `https://yukvinc.com.tr/yonetici-kurulum/` adresini açın.
2. `ADMIN_BOOTSTRAP_SECRET`, yönetici e-postası ve en az 14 karakterli güçlü bir parola girin. Bu işlem yalnızca ilk yönetici yoksa çalışır.
3. Kurulum tamamlanınca Variables and Secrets'tan `ADMIN_BOOTSTRAP_SECRET` değerini silin.
4. `/admin/` adresinde e-posta, parola ve `ADMIN_SECURITY_CODE` ile oturum açın.

Panelde ilan onayı, düzenleme ve kullanıcı yönetimi; site renkleri, logo, font, metin, SEO başlığı, SSS, bölüm sırası ve iletişim bilgileri bulunur. Yönetici paneli `noindex` olarak işaretlenmiştir. KVKK sayfasındaki gerçek ticari unvan, adres ve başvuru e-postasını yayın öncesi tamamlayın.

## Son kontrol

- `https://yukvinc.com.tr` ana adresi açılır; `https://www.yukvinc.com.tr` aynı sayfa yoluyla ana adrese 301 yönlenir.
- `/api/public-settings`, `/api/listings`, `/api/auth/*`, `/api/admin-*`, `/ilan/{id}/`, `/kategori/{slug}/`, `/sehir/{slug}/` ve `/sitemap.xml` Worker router'ından geçer.
- Robots/sitemap/canonical ve JSON-LD `yukvinc.com.tr` kullanır.
- Arama sıralaması veya Google dizine alınması garanti edilemez; Search Console'da yeni alan adının sahipliğini doğrulayıp `https://yukvinc.com.tr/sitemap.xml` gönderin.
- Yerel test: `npm test` (13 test). `node --check src/worker.js` Worker giriş dosyasının sözdizimini kontrol eder.
