# Üniversite 4/B ve KPSS radarı

## Kullanım ve kapsam

Yönetim panelindeki **Üniversite 4/B ve KPSS ilanları** bağlantısı `/admin/universiteler/` sayfasını açar. Mevcut yönetici oturumu ve yapılandırılmışsa Cloudflare Access doğrulaması gerekir. `/api/university-radar` aynı verinin salt okunur yönetici görünümüdür.

4 Kasım 2026 tarihli katalog, YÖK'ün `https://www.yok.gov.tr/university?type=1` ve `?type=2` dizinlerindeki 202 kurumu ve YÖK ana sayfasındaki Millî Savunma ile Türk-Japon üniversitelerini içerir: **204 kurum**. e-Devlet üniversite listesi ve YÖK Atlas listesiyle karşılaştırıldı; eski Kahramanmaraş İstiklal adı YÖK'te İstiklal Bilim ve Teknoloji Üniversitesi olarak yer alıyor. Yurt dışındaki ortak üniversiteler ve bağımsız meslek yüksekokulları Türkiye üniversiteleri kapsamına eklenmedi.

İlk otomatik keşifte 140 kurumda ilgili resmî sayfa bağlantıları, 115 kurumda personel/insan kaynakları bağlantısı bulundu. Doğrudan resmî sayfa araştırmasıyla bu kapsam 173 kurumda ilgili bağlantı ve 154 kurumda personel bağlantısına genişletildi. YÖK kaydındaki Hakkari/Sinop web adresleri düzeltildi; YÖK tarafından listelenen sabanciuniv.edu alan adı açık izin listesine alındı. Bunlar doğrulanmış tüm personel ilanlarının eksiksiz tarandığı anlamına gelmez. `university/catalog.json` ilk kontrolün ham kapsamını ve hatalarını korur. Başarılı başlangıç erişimi, çalışma zamanında başarılı tarama olarak sayılmaz.

Kariyer Kapısı ve Resmî Gazete her üniversitenin görünümünde resmî kontrol bağlantıları olarak bulunur. Doğrulanmış açık API/RSS okuyucusu olmadığı için otomatik taranıyor sayılmazlar. Oturum/CAPTCHA veya erişim kısıtları aşılmaz. HTML, RSS ve Atom okuyucusu bağlı kaynakları okur. PDF eklerinin tabloları, JavaScript ile yüklenen duyurular, sayfalı arşivlerin tamamı ve yetkili API gerektiren kaynaklar kapsam dışı kalabilir. Panel bunu açıkça belirtir.

## Zamanlama ve güvenilirlik

Yeni `*/2 * * * *` görevi, her çalışmada en fazla iki kaynağı sırayla tarar. Eski dakika ve haftalık görevleri aynen çağrılmaya devam eder. Personel kaynakları 24 saat, genel duyuru kaynakları 48 saat, ana sayfa keşfi 7 gün hedef aralıkla sıraya girer. Her kaynakta kilit, hata sonrası artan bekleme, HTTPS/resmî alan adı doğrulaması, sınırlı yönlendirme, robots kontrolü, süre/boyut/istek sınırı vardır. Kaynak başına 20 dış istek üst sınırı ve 3 detay okuması vardır. İşlenmemiş detay varsa kaynak 15 dakika sonra tekrar kuyruğa girer. Yoğunluk nedeniyle hedef aralık aşılabilir; panel gerçek son kontrolü ve sonraki planı gösterir.

Robots dosyası 404 ise kural bulunmadığı kabul edilir; 403, 5xx, HTML hata sayfası veya zaman aşımında okuma yapılmaz. Robots uygunluğu yeniden yayınlama lisansı iddiası değildir. Tam metin yayımlanmaz; başlık, kısa kanıt, şart etiketleri ve özgün resmî bağlantılar yöneticiye gösterilir. API erişimi için doğrulanmamış uç noktalar tahmin edilmez.

2026 KPSS P93 etiketi yalnız açık yıl/puan kanıtıyla verilir. Laboratuvarla puan türünün aynı kısa koşul bölümüne bağlanamadığı çok pozisyonlu ilanlar belirsiz kalır. 2024 ve birden fazla yıl içeren ilanlar ayrı etiketlenir. Sonuç, yedek, düzeltme ve iptal duyuruları yeni açık alım sayılmaz. Vakıf iş ilanları metinde 4/B/sözleşmeli personel kanıtı yoksa 4/B olarak sunulmaz. Tarih bulunamazsa veya çelişirse açıklık doğrulanmaz. Yayın tarihi ve başlangıç tarihi gelecekte olan ilanlar açık sayılmaz. Son kontrolü 24 saatten eski kayıt açık gösterilmez; geçmiş son başvuru kapanır. 404/410 kaldırılmış, diğer erişim hataları doğrulanmamış sayılır.

Tekrarlanan URL'ler temizlenip tekilleştirilir. Üniversite, başlık, tarihler, KPSS koşulları ve aynı metin parmak izi eşleşirse yinelenen kayıt ana kayda bağlanır; kaynak bağlantıları korunur. Farklı alım dönemleri tek başlık yüzünden birleştirilmez.

## Canlı sürüm ve güvenli dağıtım

GitHub `main`, üretimdeki İş Radarı'nı içermiyor. Bu yüzden `src/production-baseline.mjs`, 4 Kasım'da üretimden okunan V215'in birebir kodudur; yalnız iki mevcut kimlik doğrulama fonksiyonunu dışa açan son satır eklenmiştir. Orijinal bölümün SHA-256 özeti: `52cf5d7d156dead58495df2f1979f5697201460219d277e40919252370d92934`. Test bu özeti doğrular. Yeni giriş `src/university-worker.js`, mevcut kodu sarmalar ve yalnız üniversite sayfası/API'si, panel bağlantısı ve yeni zamanlamayı ekler. Mevcut kaynak, vinç ilanı veya laboratuvar tablolarına yazmaz.

`0016_university_radar.sql`, `0017_university_catalog_seed.sql` `0018_university_verified_sources.sql` `0019_university_index_hygiene.sql` ve `0020_university_index_validation.sql` yalnız yeni tabloları/kataloğu ekler, tekrar çalıştırılabilir. Mevcut veri tabanına eski `main` migration'larının tamamı tekrar uygulanmamalıdır. Önce bu beş dosya önizleme D1'de doğrulanır, sonra `yukvinc-db`'ye uygulanır.

`wrangler.university.jsonc` uyumluluk/bağlantı ve derleme kontrolü içindir. **Mevcut statik varlıklar GitHub main'den daha yeni olabilir. Üretime normal Wrangler assets yüklemesi yapılmamalıdır.** Cloudflare API kod yüklemesinde mevcut bağlar, gizli değerler ve `keep_assets: true` korunmalı; kod dışında rota/alan adı değiştirilmemelidir. Yeni cron, eski iki cron korunarak eklenmelidir. Geri dönüş, önceki sürüm `d645bd49-6a6c-4bc9-8e88-a346cb9d2f0d` %100 dağıtımı ve yalnız yeni cron'un kaldırılmasıdır. Yeni tablolar geri dönüşte silinmez.

## Doğrulama

`npm test`: mevcut testler, KPSS/tarih/erişim/yinelenme senaryoları, yerel SQLite D1 akışı ve Miniflare içinde V215 ile aday sürümün mevcut uç noktalarının karşılaştırması. Yeni yönetici sayfasının oturumsuz kapalı olduğu ve oturumla çalıştığı test edilir. `npx wrangler deploy --config wrangler.university.jsonc --dry-run` gerçek yükleme yapmadan derlemeyi doğrular.

Katalog yeni üniversite veya değişmiş personel adresleri için YÖK diziniyle yeniden karşılaştırılmalıdır. Ana sayfa keşfi mevcut üniversitelerin bağlantılarını günceller; yeni üniversite eklenmesi kendiliğinden varsayılmaz.

Tekil duyuru, sonuç, belge, mevzuat ve dil değiştirme bağlantıları kaynak dizini sayılmaz; katalogda açıklamayla durdurulur. Kapsam özeti yalnız etkin dizinleri sayar.

207 etkin duyuru/personel dizini ve 204 ana sayfa keşfi tutulur. Personel istatistikleri, tekil içerikler ve dizin olduğu doğrulanamayan rotalar katalogda kalır; bu rotalar başarılı dizin kapsamına eklenmez.
