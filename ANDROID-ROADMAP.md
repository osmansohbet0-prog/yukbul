# Android geliştirme iş listesi

## 0.7.0 — keşfet ve görünüm
- [x] Sisteme uyumlu açık/koyu tema ve kalıcı kullanıcı tercihi.
- [x] Büyük fotoğraflı ilan kartları, ana ekrandan arama.
- [x] Son görüntülenen 12 ilan, geçmişi temizleme.
- [x] İlan bağlantısı kopyalama ve WhatsApp paylaşımı.
- [x] Favori yazmalarını sıraya alma ve ekranlar arası durum yenileme.
- [x] Favorileri ilk sonuç sayfasıyla sınırlamadan detay API'sinden yükleme.
- [x] Depolama, tema ve dar ekranda büyük yazıyla kart testleri.
- [x] Flutter analiz ve testler.
- [x] Kalıcı anahtarla imzalı APK, imza/mimari doğrulaması, Android 14 emülatöründe önceki sürüm üstüne kurulum ve açılış geçti.

Test artifact: https://github.com/osmansohbet0-prog/yukbul/actions/runs/44128373573/artifacts/14348828397
Gerçek telefonda kullanıcı akışlarının uçtan uca doğrulaması henüz yapılmadı.

**Değiştirilen dosyalar:** mobile/lib/main.dart, mobile/lib/appearance.dart, mobile/lib/favorites.dart, mobile/lib/app_update.dart, mobile/pubspec.yaml, mobile/test/discovery_test.dart, mobile/test/app_test.dart, .github/workflows/yukvinc-mobile.yml.

Kod: dbc2f76144e27c1ec7d960af96cef948cbb7a5b4
PR: https://github.com/osmansohbet0-prog/yukbul/pull/75
CI: https://github.com/osmansohbet0-prog/yukbul/actions/runs/44128373573

## Sıradaki işler (öncelik sırası)
- [ ] Google oturumunu mevcut Turnstile / HttpOnly çerez sözleşmesi ile güvenli mobil akışa bağla; iptal, tekrar deneme, süre aşımı ve oturum geri yükleme testleri ekle.
- [ ] Aynı kullanıcı hesabıyla yerel profil görüntüleme/düzenleme ve fotoğraf yükleme.
- [ ] Yerel ilan oluşturma/düzenleme/silme; mevcut yetki ve moderasyon kontrollerini kullan.
- [ ] Teklif verme, iş talebi ve durum yönetimi ekranları.
- [ ] Gerçek cihazda konum izni reddi, yaklaşık konum, en yakın ilanlar ve acil yardım uçtan uca testleri.
- [ ] Favorileri hesapla eşitleme (şu an yalnızca cihazda).
- [ ] Gerçek cihazda erişilebilirlik, açılış süresi, kaydırma ve bellek ölçümü.
- [ ] Eski sürümden yükseltirken oturum/veri korumasını gerçek cihazda doğrula.

## Devam notu
`feature/android-discovery-design` dalından devam et. PR #75, #74 üzerine kuruludur; #74 ise mobil MVP dalını hedefler. PR #72 EVREN çalışmasını ezme. Mevcut API'leri incelemeden yeni sözleşme veya sahte servis üretme. Ana dalı birleştirmek veya canlı site/APK yayını yapmak ayrıca kullanıcı onayına bağlıdır. Test artifact'ı dağıtım değildir.

# Android 0.6.0 geliştirme kaydı

**Tamamlanan iş:** Uygulama içinde güncel ilan detayları, kaydırılabilir ve yakınlaştırılabilir fotoğraf galerisi, kaldırılan ilan ve hatalı sunucu yanıtlarında tekrar deneme.

**Değiştirilen dosyalar:** mobile/lib/main.dart, mobile/test/listing_detail_test.dart, mobile/pubspec.yaml, .github/workflows/yukvinc-mobile.yml.

**Test sonucu:** Flutter analiz ve testler, APK derleme, kalıcı imza/mimari doğrulaması, Android 14 emülatöründe önceki sürüm üzerine kurulum ve açılış geçti. Test APK artifact olarak kaydedildi. Public yayın işi bu geliştirme dalında atlandı.
https://github.com/osmansohbet0-prog/yukbul/actions/runs/44121795128

**Commit:** e196074901e3392d0c1c0ed3c6d9356d6b1452f2

**PR:** https://github.com/osmansohbet0-prog/yukbul/pull/74

**Sıradaki görev:** Google oturum akışını mevcut Turnstile ve HttpOnly çerez sözleşmesiyle güvenli biçimde Android'e entegre etmek. Mevcut profil ve ilan yönetimi API'lerini tekrar kullanarak yerel ekranlara bağlamak. Backend sözleşmeleri eksikse ayrı dalda eklemek ve test etmek.

Telefon API yanıtında bulunursa iletişim düğmeleri gösterilir. Mevcut ilan detay API'si çoğu ilanda telefon alanı döndürmez. Gerçek cihazda galeri hareketleri ve canlı API bağlantısı henüz doğrulanmadı. Hesap, profil, ilan oluşturma/düzenleme, fotoğraf yükleme, teklifler ve iş talebi akışları açık iş olarak devam eder.

0.5.0'daki cihazda kalıcı favoriler korunur. Web ile favori eşitleme API'si geliştirilmelidir. Canlı site dağıtımı ayrı onaya bağlıdır.
