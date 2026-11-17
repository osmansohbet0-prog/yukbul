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
