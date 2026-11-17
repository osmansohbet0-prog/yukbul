# YükVinç Android — kalan işler

## Tamamlanan
- [x] Google oturumunu Android'e güvenli şekilde aktarma (v0.8.0).
- [x] İlanları, aramayı, yakındakileri ve ilan detayını uygulamada gösterme.
- [x] İlan oluşturma, en fazla 3 fotoğraf ekleme, kendi ilanlarını görme, düzenleme ve kaldırma için yerel ekranlar (PR #82).

## Öncelikli
- [ ] Google hesabı/oturum ve profil bilgilerini uygulama içinde düzenleme; önce desteklenen alanları ve API sözleşmesini doğrula.
- [ ] FCM cihaz kaydı, kayıtlı aramalar ve backend push gönderimi; Firebase proje/secret gereksinimini tamamla.
- [ ] İşveren iş talebi oluşturma ve talep listesi; API mevcut değilse yetki ve moderasyon kurallarıyla ekle.
- [ ] Teklif oluşturma, görüntüleme ve durum takibi; sunucu API'si ve kullanıcı yetkileri doğrulanmalı.
- [x] İlan formunda 81 il ve ilçeyi doğrulanmış listeden seç; yanlış il/ilçe eşleşmesini engelle.
- [x] İncelemedeki, işaretli veya reddedilmiş ilana uygulama içinden itiraz gönder.
- [ ] Fotoğraf kırpma, sıkıştırma önizlemesi ve başarısız yüklemeyi tekrar deneme.
- [x] Ana ilan akışında cursor sayfalaması, aşağı kaydırma ve son sayfa çevrimdışı önbelleği.
- [ ] Yol yardımı için doğrulanmış API/konum paylaşımı yoksa sahte canlı veri gösterme; gerçek akış için sunucu sözleşmesi oluştur.
- [ ] Hesap menüsündeki siteye yönlendiren aksiyonları yerel ekranlara taşı.

## Her değişiklikte doğrula
- [ ] `flutter analyze`
- [ ] `flutter test`
- [ ] Release APK derlemesi, imza doğrulaması ve Android 14 kurulum testi
- [ ] Eski oturum ve uygulama verisini koruyarak sürüm yükseltme testi

Yayın öncesi `/gizlilik/` sayfasındaki işletme/veri saklama alanlarını doğrula ve kullanım koşullarını yayımla. Üretim site dağıtımı ve Android release, PR incelemesi ve geçerli testlerden sonra ayrı işlem olarak yapılır.
