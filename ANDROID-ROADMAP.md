# YükVinç Android — çalışma kaydı

## Bu döngü

- **Tamamlanan kod:** İlan kartlarına favori düğmesi; Favorilerim ekranı; favorilerin cihazda kalıcı saklanması.
- **Görünür sınır:** Sunucuda web ve Android arasında ortak favori API'si yok. Favoriler bu sürümde yalnızca kullanılan Android cihazda tutulur. Favoriler ekranı halen yayındaki ilanları sunucudan yeniden alır.
- **Sürüm:** `mobile/pubspec.yaml` 0.5.0+5. Güncelleme denetleyicisinin yerel varsayılan sürümü de 0.5.0.
- **Kontrol:** `FavoritesStore` için ekleme, tekrar okuma ve kaldırma birim testleri eklendi. GitHub Actions commit `6580973dc4eff0966c747c7aa45df61211278952` üzerinde analiz, test, imzalama ve Android 14 emulator kurulumunu yürütüyor. Sonuç bekleniyor.
- **Yayın:** Üretim sitesi değiştirilmedi. İmzalı APK oluşturulması mevcut Android workflow'unun yetkili release davranışıdır.

## Sıradaki işler

1. **Giriş ve oturum:** Mevcut Google uç noktası Google ID token'ı ile birlikte Turnstile doğrulaması ister ve HttpOnly oturum çerezi döndürür. Android istemcisi için Turnstile'ı atlamadan doğrulama akışını tasarla; çerezleri cihazda güvenli sakla, yenileme/çıkış davranışını test et. Giriş yapılandırması yoksa açıkça hata göster.
2. **Hesabım ve profil:** Kullanıcı adı/şirket bilgisi, fotoğraf ve mevcut profil API sözleşmelerini doğrula; sadece gerçek API ile çalışan işlevleri göster.
3. **İlan yönetimi:** Fotoğraf boyut/format sınırlarına göre sıkıştırma, taslak, oluşturma ve düzenleme uç noktalarını test et; sunucudaki moderasyon kuyruğunu koru.
4. **Teklifler ve iş talepleri:** Mevcut yetkili API ve roller bulunmadan yerel sahte kayıt üretme. Önce backend sözleşmesini ve admin onay durumlarını doğrula.
5. **Ortak favoriler:** Web hesabı ve Android arasında senkron için yetkilendirilmiş, sahiplik kontrolü olan API ve testleri ekle.
6. **UX ve performans:** Filtre/konum hata durumları, erişilebilirlik, zayıf bağlantı ve düşük bellek cihazları için ölçülebilir testler.

## Güvenli yayın sınırı

- Android geliştirmesi `feature/yukvinc-mobile-mvp` dalında kalır.
- `main` canlı Cloudflare Worker ve statik varlıklarla sürüm farkı taşıyabilir; site paketini bu daldan doğrudan dağıtma veya birleştirme.
- Her APK sürümünde CI analiz/test, imza, sabit paket kimliği, yükseltme, mimari ve emulator açılış kontrolleri başarılı olmalı.
