# YükVinç — GitHub ve Cloudflare Pages kurulumu

Bu paket Aşama 1–3 kaynak kodunu içerir. Site görünümü korunur; ana sayfa artık örnek kart yerine yönetici onaylı gerçek ilanları okur. Admin görünümünde renk, yazı tipi, logo/kapak görseli, SEO başlığı/açıklaması, iletişim metinleri, SSS ve bölüm sırası düzenlenebilir. Üye kaydı/girişi, ilan verme ve fotoğraflar Cloudflare D1 üzerinde çalışır.

**Canlıya almadan önce:** D1 migration dosyalarını çalıştırın, Pages ayarlarında `DB` binding ile Turnstile anahtarlarını ekleyin, ilk admin hesabını kurun ve admin iletişim alanlarına gerçek bilgileri girin. Gizli değerleri GitHub'a yüklemeyin.

## 1. GitHub'a yükleme (bilgisayarda komut satırı gerekmez)

1. GitHub'da `yukbul` deposunu açın. Değişiklikleri geri alabilmek için mevcut depo dosyalarının bir kopyasını indirin.
2. Bu ZIP'i bilgisayarınıza indirin ve açın. ZIP içindeki `public`, `functions`, `migrations`, `tests` klasörleri ile `package.json` ve `KURULUM.md` dosyalarını seçin. ZIP'in kendisini değil, içeriğini yükleyin.
3. GitHub'da **Add file > Upload files** seçin. Dosyaları deponun köküne sürükleyin; klasör yolları aynı kalsın. Örneğin `public/index.html`, `functions/api/auth/register.js`, `migrations/0002_accounts_marketplace.sql`.
4. Sayfanın altındaki **Commit changes** düğmesiyle kaydedin. Aynı adlı dosyalar güncellenir; yeni dosya ve klasörler eklenir. ZIP'teki bir dosya GitHub'da bulunmuyorsa ve artık kullanılmıyorsa eski dosyayı ayrıca silin.
5. Cloudflare **Workers & Pages > yukvinc projesi > Settings > Builds & deployments** ekranında Framework preset'i **None**, Build output directory değerini `public`, Root directory değerini boş bırakın. Build command boş kalabilir. Proje GitHub'a bağlı olmalı; her commit otomatik yayın başlatır.

## 2. D1 veritabanı

Daha önce Aşama 2 kurulumu yapıldıysa `0001_initial.sql` zaten çalışmıştır. Bu durumda yalnızca `migrations/0002_accounts_marketplace.sql` dosyasını **bir kez** çalıştırın. D1 hiç kurulmadıysa önce `0001_initial.sql`, ardından `0002_accounts_marketplace.sql` çalıştırın.

1. Cloudflare **Workers & Pages > D1 SQL Database > yukvinc-db > Console** ekranını açın.
2. İlgili SQL dosyasını bilgisayarda metin düzenleyiciyle açıp tümünü kopyalayın; D1 Console'a yapıştırıp **Execute** seçin.
3. Tables ekranında `users`, `listings`, `listing_photos`, `listing_reports`, `site_settings`, `admin_sessions`, `user_sessions`, `site_assets` ve `ai_usage` tablolarını görün.
4. D1 görselleri de küçük BLOB kayıtları olarak saklar; üçüncü taraf görsel alanı veya R2 gerekmez. İlan başına en çok üç görsel, her biri 200 KB; admin logo/kapak dosyaları 350 KB ile sınırlıdır. Bu, ilk küçük kullanım için uygun çözümdür; D1 Free toplam 500 MB ve satır/BLOB başına 2 MB sınırına sahiptir. Günlük ücretsiz okuma/yazma kotaları aşılırsa sorgular kota yenilenene dek durabilir. Kullanım büyürse ücretli depolama/Workers planına geçmeden önce onay alın. Cloudflare D1 limitleri ve fiyat bilgisi: https://developers.cloudflare.com/d1/platform/limits/ ve https://developers.cloudflare.com/d1/platform/pricing/.

## 3. D1'i Pages'e bağlama

1. Cloudflare **Workers & Pages > yukvinc > Settings > Bindings > Add > D1 database** seçin.
2. Variable name alanına tam olarak `DB` yazın, `yukvinc-db` veritabanını seçip kaydedin.
3. Önizleme alan adlarında API yazma işlemleri güvenlik nedeniyle kapalıdır; uçtan uca hesap/ilan testini özel alan adınız açıldıktan sonra yapın. **Deployments > Retry deployment** ile yeniden yayınlayın.

## 4. Turnstile ve gizli ayarlar

Turnstile, kayıt/giriş bot korumasıdır. Cloudflare **Turnstile > Add widget** ekranında `yukvinc.com.tr` ve `www.yukvinc.com.tr` hostnamelerini ekleyin. Cloudflare'ın gösterdiği Site Key herkese açık anahtardır; Secret Key gizlidir.

Pages projesinde **Settings > Variables and Secrets > Add** açın ve Production ortamına ekleyin:

| Ad | Tür | Nerede kullanılır |
|---|---|---|
| `TURNSTILE_SITE_KEY` | Text (public key) | Üye giriş/kayıt ekranındaki doğrulama kutusu |
| `TURNSTILE_SECRET` | Secret / Encrypt | Sunucunun Turnstile doğrulaması |
| `ADMIN_SECURITY_CODE` | Secret / Encrypt | Admin girişinde parola yanındaki ek güvenlik kodu |
| `ADMIN_BOOTSTRAP_SECRET` | Secret / Encrypt, yalnızca ilk kurulumda | İlk admin hesabını bir defa açar; admin kurulduktan sonra silin |

`ADMIN_SECURITY_CODE` için en az 8 karakterli, tahmin edilmesi zor yeni bir kod kullanın. `ADMIN_BOOTSTRAP_SECRET` en az 32 karakterli rastgele bir değer olsun. Bu değerleri sohbet, dosya veya GitHub'a yazmayın; ayarları kaydettikten sonra yeni deployment başlatın. Daha önce admin oluşturduysanız tekrar bootstrap yapmayın; yalnızca `ADMIN_SECURITY_CODE` kontrol edin.

## 5. Admin hesabı ve panel

İlk yönetici hesabı henüz oluşturulmadıysa HTTPS alan adınız açıldıktan sonra `/yonetici-kurulum/` adresini açın. Secret, yönetici e-postası ve güçlü bir parola girin. Başarı mesajından sonra Cloudflare Secrets listesinden `ADMIN_BOOTSTRAP_SECRET` değerini silin. Admin'e `/admin/` adresinden e-posta, parola ve `ADMIN_SECURITY_CODE` ile girin.

Admin'de **Site tasarımı** bölümünden renk, font, logo/kapak dosyası, ana başlık, tanıtım, Google başlığı/açıklaması, FAQ, iletişim alanları ve bölüm sırası değişir. “Dosya seç” ile logo veya kapak görselini doğrudan panele yükleyebilirsiniz. Önizleme alanı yazarken anında güncellenir. **İlanlar** sekmesinde admin ilanı ekleyebilir; kullanıcı ilanlarını düzenleyip onaylayabilir, reddedebilir veya kaldırabilir. **Kullanıcılar** sekmesinde hesabı kapatmak tüm kullanıcı oturumlarını da iptal eder.

Admin e-posta/telefon/adres alanları şu anda bilerek boş başlar. Admin'den gerçek iletişim verilerini ekleyin. Kullanıcıların ilan telefonu, kullanıcı açıkça rıza verdiğinde ilan detay sayfasında görünür; şirket adına sahte telefon/WhatsApp düğmesi eklenmez.

## 6. Google ve SEO

Ana sayfa için başlık/açıklama admin panelinden değişir. Onaylı ilan detayları sunucu tarafında başlık, açıklama, canonical ve WebPage JSON-LD ile oluşturulur. Sitemap onaylı ilanları, ilan şehri ve dolu kategorileri otomatik ekler: `https://yukvinc.com.tr/sitemap.xml`. Yayımlanmamış ilanlar Google'a açılmaz. Sahte şehir/hizmet sayfaları veya LocalBusiness işletme şeması eklenmedi; bu bir ilan pazaryeridir, doğrulanmış tek bir yerel şirket/filo bilgisi verilmedi.

1. Cloudflare'da **Workers & Pages > yukvinc > Custom domains** altında `yukvinc.com.tr` ve `www.yukvinc.com.tr` etkin olsun. `www` ana alan adına yönlenir; canonical URL `https://yukvinc.com.tr`.
2. Google Search Console'da `https://yukvinc.com.tr` alan adının doğrulanmış mülkünü açın. Site taşındıysa yeni mülkte **Sitemaps** ekranına `sitemap.xml` gönderin.
3. Yayından sonra URL Inspection ile ana sayfayı ve örnek bir *onaylı ilan* detayını kontrol edip gerekirse bir kez **Request indexing** seçin. Tarama/dizin oluşturma birkaç gün ya da daha uzun sürebilir; Google sıralama veya dizine alma garantisi vermez. Search Console yalnızca erişebildiğiniz mülkün URL'leri için dizin isteği alır: https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl.
4. “Vinç kirala” veya “şehir yol yardım” aramalarında rekabetçi görünürlük; gerçek ilanların, kullanıcıların doldurduğu özgün açıklamaların, şehir bazlı arzın, erişilebilir sayfaların ve güvenilir dış bağlantıların zamanla oluşmasına bağlıdır. Onaysız/boş şehir sayfaları indekslenmez; arama konumunu kodla garanti etmek mümkün değildir. Google çok sayıda özgün olmayan yapay sayfayı sıralama manipülasyonu sayabilir: https://developers.google.com/search/docs/essentials/spam-policies.

## 7. Test akışı

Ayarlar ve migration sonrası şu sırayla kontrol edin:

1. `https://yukvinc.com.tr/giris/` adresinde bir test üye hesabı açın; Turnstile kutusunu bir kez doğrulayın.
2. `/ilan-ver/` ekranında vinç, oto kurtarıcı, sepetli platform, iş makinesi, nakliyat asansörü veya operatör türü seçin. İl/ilçe, açıklama, iletişim telefonu girin; adresi boş bırakabilirsiniz. En fazla üç küçük fotoğraf ekleyip son adımda onaya gönderin.
3. `/hesabim/` sayfasında ilanı “Onay bekliyor” görün. Admin panelinden onayladıktan sonra ana sayfada filtreleyin, detay sayfasını, fotoğrafı, ilan sahibinin numarasını ve “Şikayet et” akışını kontrol edin. Arama/karşılaştırma yalnızca fiyatı bulunan gerçek onaylı ilanları kullanır.
4. Aynı ilanı yeniden deneyin; yinelenen içerik reddedilmeli. Aynı üye günde beşten fazla ilan veremez; hesap/IP hız kontrolleri geçerli olmalıdır.
5. Admin ayarları kaydedip ana sayfada değişiklikleri doğrulayın. `npm test` yerel testleri çalıştırır (Node.js gerekir); bu adım canlı ortamın yerine geçmez.

## 8. Şu an kapalı tutulan ücret riski

İlan metni önerisi için Workers AI uç noktası hazır, ancak güvenli varsayılan olarak kapalıdır. Bu kodda `AI_ENABLED` etkin değil ve Cloudflare AI binding yoksa form normal biçimde çalışır, kullanıcı metni elle yazabilir. Workers AI fiyatı model/kullanıma bağlı olduğu için Cloudflare panelinde hesabınızda gerçekten ücretsiz kullanım bulunduğunu doğrulamadan açmayın veya ücretli plana geçmeyin. Cloudflare AI fiyatları: https://developers.cloudflare.com/workers-ai/platform/pricing/.

## 9. KVKK alanları

`/gizlilik/` metni veri akışını açıklar; ancak veri sorumlusu ticari unvanı, adresi ve başvuru kanalı size ait olduğu için hazır doldurulmamıştır. Yayından önce gerçek unvanı/adresi ve KVKK başvuru e-postasını ekleyin; bu iletişim alanları admin tasarım ayarlarında bulunur. İlana girilen telefonun herkese açık detayda yayımlanmasına dair onay kutusu vardır. Üyelik, IP hız kontrolü, fotoğraf, ilan görünürlüğü, saklama ve silme süresi metni dağıtımdan önce işletme koşullarınıza göre gözden geçirin.
