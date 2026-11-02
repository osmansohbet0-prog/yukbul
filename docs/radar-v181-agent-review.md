# Radar V181 — ajan incelemesi ve uygulanan geliştirmeler

Üç uzman ajan alıcı bulma, doğrulama ve yönetici akışını ayrı ayrı inceledi. Ek bir ajan son entegrasyonu bağımsız kontrol etti. Öneriler kodlandı; yalnız fikir veya yeni prompt üretilmedi.

## Uygulanan iyileştirmeler

1. **Daha esnek arama:** `"Kocaeli Gebze Güzeller Mahallesi"` yerine konum parçaları ayrı aranır. Vinç, manlift, manito/telehandler için “kiralamak istiyorum”, “kiralamak istiyoruz”, “kiralayacağız”, aylık ve uzun dönem ifadeleri eklendi. Arama motorunun son 24 saat filtresi asıl yayın tarihinin kanıtı sayılmaz; bu ayrım metadata’da korunur.
2. **Konum kaybının giderilmesi:** Yalnız “Gebze” geçen kaynak metninden tekil ilçe kanıtıyla Kocaeli/Gebze bulunabilir. Çok illi kaynak kapsamından ilk il seçilmez; belirsiz konum belirsiz kalır. Scanner’ın AI taslağına şehir, ilçe, kurum ve kaynak açıklaması eksiksiz taşınır.
3. **Daha sıkı otomatik yayın:** RSS `updated` alanı özgün yayın tarihi sayılmaz. Asıl sayfanın yayın zamanı son 24 saat içinde olmalı; açık teklif saati ve tarihi kaynakla eşleşmelidir. Saat eksikse otomatik yayın durur. Kapanış saatine fazladan 59 saniye eklenmez; ISO zaman dilimi korunur. Düşük AI güveni kural puanıyla yükseltilmez; geçersiz/sonsuz puan reddedilir. Doğrulama sürerken kaynak izni kaldırılırsa son atomik yazma da yayını reddeder.
4. **Farklı alıcıların korunması:** Aynı şehir ve benzer başlık, iki farklı kaydı otomatik birleştirmek için kullanılmaz. Aynı kaynak URL’sinin tekrarları hâlâ ayıklanır.
5. **Kaynak ekranı:** İl/ilçe/mahalle seçicileri, uzun mevcut kaynak listesinin üstüne taşındı. Kaynaklar aynı kapanabilir bölümde kalır. “Son 24 saatte aday” sayacı doğru anlamıyla “Son 24 saatte eklenen” olarak adlandırıldı.
6. **Karar desteği ve iletişim:** Adayda ön eleme puanı, eksik kanıt, kaynak tarihi ve varsa o adayla ilişkili doğrulanmış kurumsal telefon gösterilir. Puan kesin doğrulama diye sunulmaz. Telefonun doğrulama tarihi ve iletişim durumu korunur; geçmiş telefonlar güncel açık iş sayılmaz. Otomatik arama/mesaj gönderimi eklenmedi.
7. **Radar sağlık görünümü:** Kayıtlı, etkin, çalışan ve yayın izni hazır kaynak sayıları ayrı hesaplanır. Öncelikli bölgede çalışan kaynak olmaması, yayın hakkı eksikliği ve kaynak hataları için somut sonraki adım gösterilir. Yeni eklenme zamanı, taze kaynak kanıtının yerine geçmez.
8. **Tutarlı izin akışı:** Ayrı okuma ve yeniden yayın izinleri tamamlanmış resmî HTML kaynağı, otomatik akışta olduğu gibi insan onayında da aynı izin kontrolünden geçer.

## Gerçek dağıtım

- Canlı: `yukbul` **V181**, `92c3c58f-e6c9-4990-ab71-c16f8d0c2ee9`, trafik %100.
- Staging: **V36**, `9e077fdd-9098-4408-95e4-47315e01d842`.
- Canlı SHA-256 geri okuması: `3262c7228ab74cc0da01f1e9e3fa8064ff688c4297b28d5b0582ab6ca86ad7c7`.
- Staging SHA-256 geri okuması: `517b182df60295f79c9dfe78ca84fd4d5f7d8850800b6b9eed98095d2421c385`.
- Geri dönüş: V180, `bfcb9e1b-edba-4491-9551-bfd62e60594c`.
- Worker bağları ve ASSETS ayarları V180 ile aynı tutuldu. Üretim veritabanı migration veya toplu kayıt değişikliği yapılmadı.

## Doğrulama

**322/322 test geçti.** Kaynak tarih/saat hataları, saatsiz ihale, yeni feed/eski asıl ilan, düşük AI güveni, izin iptali yarışı, yanlış mükerrer birleştirme, izinli HTML insan onayı, konum taşıma, arama niyeti ve yönetici iletişim görünümü için davranış testleri çalıştırıldı. AI ve yeni yayın senaryoları kontrollü yerel test verisiyle sınandı; gerçek sahte müşteri ilanı yaratılmadı.

Yerel Cloudflare ortamındaki 44 dosya karşılaştırmasında 42 dosya aynı; Radar yönetici JS’si amaçlı değişik; offline HTML altbilgisi yerel boş DB nedeniyle farklı. Canlıda 45 mevcut dosya adresi HTTP 200 döndü. `/api/radar` anonim isteğe 401; `/api/jobs`, `/is-talepleri/`, `/ihale-duyurulari/`, `/api/saglik` 200. Kamusal iletişim bilgisi sızıntısı görülmedi. Bu turda tarayıcı kontrol aracı mevcut değildi; yönetici UI davranışı yerel VM testleri ve gömülü/public script eşitliğiyle doğrulandı, canlı yönetici ekranını yeniden açmış gibi rapor edilmedi.

Geri okumada 56 kayıtlı kaynak, 32 etkin kaynak, 8 Radar kaydı ve 7 yayımlanmış kayıt korundu. Güncel yeniden yayın izni kaydı olan etkin kaynak sayısı **0**. Kocaeli’de doğrulanmış çalışan otomatik kaynak **0** olmaya devam ediyor. 929 belediye bağlantısı ve 973 ilçe kapsamı, çalışan otomatik kaynak sayısına eklenmedi. Yeni güncel müşteri bulunduğu veya yeni otomatik yayın yapıldığı iddia edilmez.

## Sonraki yüksek etkili hedef

İlk hedef, gerçek alıcı talebi sunan bir kaynağın hem otomatik erişim hem yeniden yayın izinlerini tamamlayıp gerçek kaynakla staging doğrulaması yapmaktır. OSB/satın alma duyuruları, izinli kurum RSS’leri ve yetkili talep API’leri bu amaçla değerlendirilebilir. Kaynak izni varsayılmaz; Sahibinden genel ilan/telefon toplama erişimi açılmadı. İletişim takibinde sonraki adım, kullanıcı tarafından yapılan aramaları kayıt altına alan denetlenebilir bir durum akışı olabilir; bu sürüm otomatik dış iletişim başlatmaz.
