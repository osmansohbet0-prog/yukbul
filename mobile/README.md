# YükVinç Mobil — geliştirme dalı

Bu dizin, YükVinç ana sitesinden **ayrı** Flutter Android başlangıç uygulamasıdır.
Ana siteye, D1 verilerine, canlı üyelik tablolarına veya yayınlanan Worker'a değişiklik yapılmamıştır.

## Gerçekte çalışan ilk akışlar
- Açık ilanlar, arama ve kategori filtreleri: `GET https://yukvinc.com.tr/api/listings`.
- İlan detayını ve ilan kartlarını uygulama içinde görüntüleme.
- Google oturumuyla kendi ilanlarını uygulama içinde listeleme, düzenleme ve kaldırma.
- Yeni ilan formu, doğrulanmış il/ilçe seçimi, fotoğraf ekleme (en fazla 3), oluşturma ve durum takibi; sunucu doğrulaması ve moderasyon kuralları korunur.
- İncelemede, işaretli veya reddedilmiş ilan için uygulama içinden itiraz gönderme.
- Konum izni sonrası doğrulanmış ilana göre **yaklaşık** mesafe sorgulama: `POST /api/ai/nearby`.
- İşveren iş talebi, teklif verme, profil/firma bilgilerini düzenleme ve yol yardımı işlemleri henüz tam yerel ekran ve doğrulanmış API bağlantısına sahip değil.
- İş ve hizmet ilanlarının öne çıkarıldığı sade ana sayfa.

## Henüz hayata geçmeyenler
- Gerçek zamanlı çekici konumları, arka plan GPS, mesai/çağrı atama.
- İş Radarı'nın doğrulanmış, kamuya açık mobil API bağlantısı.
- Doğrulanmış iş başına 500 TL tahsilat.
- Gerçek yol/trafik/köprü kısıtlarıyla tahmini varış.
Bu özellikler için ayrı, güvenlik denetimli yol yardım servisi gereklidir. Geçici olarak sahte canlı kayıt/ETA gösterilmez.

## Test APK
GitHub Actions -> **YükVinç Android MVP** -> en güncel başarılı çalıştırma ->
`yukvinc-android-test-apk` dosyasını indir. Bu yalnızca test yapısıdır.
Üretim için kalıcı, güvenli imza anahtarı ve gerçek cihaz testi zorunludur.

## Yerel geliştirme
```sh
cd mobile
flutter create --platforms android --org tr.com.yukvinc --project-name yukvinc_mobile .
flutter pub get
flutter analyze
flutter test
flutter run
```

İlan oluşturma, düzenleme ve kaldırma mevcut web API sözleşmesini kullanır; uygulama içi formdan çıkan ilanlar da aynı sunucu doğrulaması ve moderasyondan geçer. `operator` kategorisi iş arayan operatör ilanıdır; işveren talebi yerine geçmez.
