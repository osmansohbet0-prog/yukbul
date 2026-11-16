# YükVinç Mobil — geliştirme dalı

Bu dizin, YükVinç ana sitesinden **ayrı** Flutter Android başlangıç uygulamasıdır.
Ana siteye, D1 verilerine, canlı üyelik tablolarına veya yayınlanan Worker'a değişiklik yapılmamıştır.

## Gerçekte çalışan ilk akışlar
- Açık ilanlar, arama ve kategori filtreleri: `GET https://yukvinc.com.tr/api/listings`.
- İlan detayını uygulama içi tarayıcıda açma.
- Konum izni sonrası doğrulanmış ilana göre **yaklaşık** mesafe sorgulama: `POST /api/ai/nearby`.
- "İş İlanı Ver" ve "İlan Ver" erişimi: mevcut `/ilan-ver/` sayfasında; güvenli mevcut kimlik doğrulama korunur.
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

Uygulamadaki mevcut "İş İlanı Ver" butonu web sitesinin formunu açar. Mevcut web API'sinde `operator_job` kategorisi **iş arayan operatör ilanıdır**, işverenin açtığı yeni bir iş talebi değildir. İşveren talebi akışı daha sonra ayrı, doğrulanmış API ile tasarlanmalıdır.
