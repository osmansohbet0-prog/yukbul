# Kocaeli/Gebze Radar — canlı V178 entegrasyon sözleşmesi

## Gerçek durum
Bu dal doğrudan canlı site sürümü **değildir**. GitHub main, Cloudflare `yukbul` V178 ve `yukbul-staging` V31 ile aynı kaynak ağacı olmayabilir. Staging'e V31 yerine eski kaynak kodunu yükleme. Canlıda mevcut admin, Google giriş, bildirim, İş Talepleri, statik asset ve D1 bağlarını koru.

## Yeni modüller
- `functions/_lib/radar-kocaeli-qualification.js`: gerçek vinç kiralama isteğini satın alma, operatör alımı ve reklamdan ayırır; tarih geçmişse reddeder; uzun dönemi önceler.
- `functions/_lib/radar-buyer-contacts.js`: kaynak URL'si doğrulanmış kurumsal telefon / e-posta, admin doğrulamasıyla okuma, tıklanabilir `tel:` ve `mailto:`.
- `functions/_lib/radar-ai-editor.js`: gerçek Workers AI çağrısını yalnızca izinli admin veya güvenli dahili tarayıcı için açar. Uydurulan rakam ve telefon içeren taslakları reddeder, `ai_model_budget` üzerinden günde 8 çağrıyla sınırlar, `lead_radar_ai_drafts` tablosuna insan onayı için yazar.
- `staging/sql/004_radar_buyer_contacts.sql`: eklemeli şema, hem preview hem canlı D1'de uygulandı; canlı D1'de resmî kaynaktan doğrulanmış üç Kocaeli kurumsal telefon kaydı var.
- `staging/kocaeli-source-prober.mjs`: mevcut staging V31'i değiştirmeyen ayrı bir **preview-only** kaynak izin/bağlantı test Worker'ı.

## Admin paneli entegrasyonu
1. Canlı V178'in gerçek `functions/_lib/lead-radar.js`, `radar-review-actions.js`, `job-board.js` ve admin giriş doğrulama mekanizmasını incele.
2. Tüm kaynaklardan aday oluştururken `qualifyCraneRentalRequest` kullan. `verified_candidate` kararı son tarih ve alıcı teyidi gerektirir; geri kalanları yayınlama. `2026/2071046` satın alma ihalesi reddedilmelidir.
3. Var olan oturum doğrulayıcısı ile **sunucuda** onaylanmış yönetici rolü üret. Sadece o doğrulamanın sonucunda `{adminVerified:true}` kullan. Bunu request JSON ya da istemci parametresinden alma.
4. Admin iş kartının `İletişim` sekmesinde `listBuyerContactsForAdmin` çağır. Bir lead'in `lead_id` bağlantısı varsa o lead'i aç; geçmiş alıcı adayları için ayrı admin CRM filtresi kullan. Halka açık `/api/jobs` asla kurumsal iletişim tablosundan veri çıkarmamalı.
5. Telefon varsa `tel:+90...`, e-posta varsa `mailto:` bağla. `historical`, `unknown`, `open_verified` durumlarını belirgin ayır. Arama/WhatsApp otomatik gönderim yapma; yönetici kendisi başlatsın. Opt-out durumunda gizle.
6. Kaynakta hâlen açık olduğu teyit edilen gerçek bir kiralama talebinde `draftRadarLeadWithAI` kullan. Modelin JSON çıktısını doğrula; sorun varsa manuel kontrol. Modelin yazdığı metin hiçbir şekilde kendiliğinden yayınlanmamalı.
7. Admin arayüzündeki `Onayla ve Yayımla` gerçek kayıt revizyonu ve kaynak hakları kontrolünden geçmeli; onay `lead_radar_review_events` ile iz bırakmalı. D1 ve auth regresyonları gerçek browser ile geçmeden prod deployment yapılmamalı.
8. Normal `/is-talepleri/` sayfasında yalnızca güncel, güvenilir vinç kiralama talebini göster; Gebze satın alma ilanını kaldır; ayrı Kocaeli sekmesi oluşturma.

## Veri durumu
2 Kasım 2026 itibarıyla canlı D1'e resmî kaynaktan doğrulanmış 3 **kurumsal alıcı/kurum irtibatı** eklendi. Bunlar açık vinç kiralama işi değildir. Kocaeli için 5 belediye/OSB duyuru bağlantısı pasif manuel doğrulama adayı olarak eklendi. Otomatik tarama ve otomatik yayın hakları henüz doğrulanmadı; çalışma durumlarını gerçek test etmeden "aktif" deme.

## Güvenlik
- Sosyal ağ özel/grup içeriklerine erişim engeli aşılmamalı; resmi API veya açıkça izinli erişim kullanılmalı.
- Kişisel telefonlar scraping ile toplanmamalı. Sadece açıkça kurumsal, kaynağı izlenebilir iletişim verisi kaydedilmeli.
- Kamu ihalesinde YükVinç teklif kabul ediyormuş gibi sunma; ilgili EKAP sayfasına yönlendir.
- Eski ihale, potansiyel müşteri ve yeni gerçek talep için üç ayrı statü tut.
- Yapay zekâ telefon numarası ve kişileri uyduramaz; yayın açık kaynak bilgisi bile admin-only kontakt bölümünde kalır.
- Otomatik mesaj, toplu arama veya spam yapılmaz.
