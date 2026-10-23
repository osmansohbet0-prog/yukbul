# YükVinç çalışma günlüğü

## 2026-10-23T22:48:19Z — Başlangıç / yedek alındı
- Başlangıç dalı: `main`
- Başlangıç commit'i: `485d256de11f1dbe069371029d745d055b72a9e1`
- Yedek dalları: `yedek/main-oncesi`, `yedek-oncesi-5saat` (Git tag değil, yedek dalı; GitHub bağlantısında tag oluşturma aracı yok).
- Çalışma dalı: `gelistirme`
- Geri alma: `main` dalını başlangıç commit'ine geri al veya `yedek/main-oncesi` dalındaki içeriği geri yükle.
- Cloudflare panel erişimi yok; canlı binding, migration durumu ve deploy sonucu buradan doğrulanamaz.
- Önceki çalışmadan devralınan kayıt: `/api/saglik` ve ilan hata kodları main'e daha önce gönderilmişti; bu oturumdaki yeni geliştirmeler sadece `gelistirme` dalında yapılacak.

## Depo özeti (erişilebilir dosyalar)
- `public/`: HTML sayfaları ve tarayıcı JS/CSS; ilan verme sihirbazı `public/ilan-ver/` ve `public/assets/listing-form.js`.
- `functions/api/`: üyelik, ilan, yönetici ve sağlık API uçları.
- `functions/_lib/`: auth, ilan doğrulama, fotoğraf saklama ve AI yardımcıları.
- `src/worker.js`: Cloudflare Worker route dispatch.
- `migrations/`: D1 SQL şema değişiklikleri.
- `wrangler.jsonc`: Worker, D1 (`DB`) ve AI (`AI`) bağları.
- Bu bağlantıda depo ağacının tamamını listeleyen araç yok; yukarıdaki dosyalar görevle ilişkili ve tek tek inceleniyor.

## Durum
- Aşama 1: İlan hata teşhisi ve iyileştirme — devam ediyor.
- Aşama 2: Workers AI — incelenecek, hatasız geri dönüş ve kota odaklı.
- Aşama 3: Teknik SEO ve Google kaynakları — incelenecek/uygulanacak.
- Aşama 4: Rakip analizi — araştırma ve yalnızca doğrulanabilir, düşük riskli öneriler.
- Canlıya alma koşulu: `gelistirme` dalı test edilir ve GitHub check görünür biçimde başarılı olursa birleştirme. Checks görünmez/başarısızsa main'e alınmayacak.

## Bilinen bulgular / varsayımlar
- İlan fotoğrafları mevcut kodda R2 yerine D1 BLOB'a yazılıyor; fotoğraf sınırı istemci/arka uçta 1,800,000 byte.
- İlan oluşturma genel mesajı API catch içindeki beklenmeyen hataları maskeliyor. Canlıdaki özgül hata kodu deploy ve D1 çıktısı olmadan doğrulanamaz.
- Operatör ilanında telefon alanı ön yüzde isteğe bağlıydı fakat arka uçta zorunlu doğrulanıyordu; uyum için arka uç kuralı güncellenecek.
- D1 migration dosyalarında tekrar eden sürüm önekleri var; canlı migration geçmişi sağlık endpoint'iyle doğrulanmadan yıkıcı/geriye dönük SQL değiştirilmeyecek.

## Sonraki adımlar
1. İlan POST/PATCH, fotoğraf, auth, migration akışını test edilebilir hale getir.
2. Çok fotoğraf/draft/slug gibi isteklerin var olan D1 kapasitesi ve migration durumu ile güvenli olup olmadığını incele; şema belirsizse canlıyı bozacak değişikliği main'e alma.
3. Workers AI ve SEO dosyalarını incele; gerçek, özgün ve ölçülebilir iyileştirmeler yap.
4. Her aşama sonunda bu dosyayı zaman damgasıyla güncelle, test ve GitHub checks durumunu kaydet.


## 2026-10-23T23:02:47.742Z — Aşama 1 tamamlandı / Aşama 2–4 incelemesi
- Canlı kök neden doğrulandı: production D1 `user_login_attempts` tablosunun CHECK kuralı yalnızca `login/register` kabul ediyordu; Worker ilan sırasında `listing` ve AI metin yardımında `ai` eylemi ekliyordu. D1 `CHECK constraint failed` hatası API'de genel ilan mesajına dönüşüyordu. Yeni `0006_user_login_attempt_actions.sql` migration'ı canlı D1'e uygulandı; 2 mevcut rate-limit satırı korundu. Canlı D1'de test `listing` satırı yazılıp silinerek yeni kural doğrulandı.
- Ön yüz/arka uç kategori, il ve telefon zorunluluğu doğrulandı; operator-job telefon tutarsızlığı düzeltildi. 81 il listesi doğrulandı.
- Fotoğraflar 100 MB ham seçimden istemcide WebP/JPEG'e sıkıştırılır; sunucuya fotoğraf başına en fazla 1,8 MB ve ilan başına en fazla 3 fotoğraf gider. D1 BLOB kullanılıyor, R2 binding yok. Üç fotoğraflı JSON istek sınırı oluşturma/düzenlemede 7,5 MB. Fotoğraf değişimi D1 batch ile atomik yapıldı.
- İlan oluşturma/düzenleme/silme oturum gerektiriyor; honeypot, günlük 5 ilan ve saatlik/IP 8 istek limitleri mevcut. Aynı hash/benzer ilan engelleniyor. AI denetimi arka planda ve başarısız olduğunda kayıt akışını kesmiyor; olası tekrar otomatik silinmiyor, yönetici incelemesine işaretleniyor.
- Testler: `node --test tests/listing-flow.test.mjs` eşdeğeri geçici doğrulama ortamında 10/10 geçti; değişen JS/MJS dosyalarına `node --check` geçti. Worker/D1 canlı entegrasyon testi yapılmadı.
- Ek test: Workers AI hatası yeni ilan kaydını engellemiyor.
- Aşama 2: var olan Workers AI yazım yardımına gövde/istek limiti, metin maskeleme, kullanıcı onayı ve hata halinde ücretsiz kota iadesi eklendi; AI önerisi optional. Moderasyon mevcutta spam/tekrar/şüpheli ifadeleri işaretliyor. Görsel AI, sohbet, semantik eşleştirme ve yönetici günlük özeti yapılmadı.
- Aşama 3: canonical slug ilan URL'leri ve dinamik sitemap; giriş/admin/hesap/ilan-ver sayfaları için X-Robots-Tag noindex; bu sayfalara robots.txt disallow kaldırıldı; arama kutusu schema özelliği kaldırıldı. Bölge/kategori sayfaları sadece mevcut ilan verilerinden türetiliyor; yüzlerce boş şehir sayfası üretilmedi.
- Aşama 4: Armut teklif/karşılaştırma akışı, Çekici Bul konum + araç + teklif karşılaştırması, 24destek mesafe hesaplama ve sektör ilanlarındaki makine kapasitesi bilgileri araştırıldı. Uygulanabilir dersler: teklif isteme, standart ekipman özellikleri, açık fiyat birimi, mesafe hesabı, gerçek yorum/kanıt koşulları. Sahte yorum/puan eklenmedi.
- GitHub checks API bu commitlerde `statuses: []` döndürüyor; başarılı build check görünür değil. `main`'e birleştirme/deploy yapılmadı. Cloudflare API erişimi açıldı; D1 production şeması ve migration geçmişi doğrudan doğrulandı. Worker build yayın durumu ayrıca doğrulanmalı.
- Kalan: Cloudflare deploy/check ve /api/saglik + Workers Logs doğrulaması; gerçek fotoğraflı kullanıcı akışı; gerekiyorsa D1 migration uyumsuzluğunu canlı migration tablosuyla belirleme. Taslak kaydetme, yenileme/yayından kaldırma ve sektöre özgü kapasite şeması değişikliği migration belirsizliği nedeniyle ana dala alınmadı.

## 2026-10-23T23:21:00Z — Cloudflare Preview build ve güvenli test ortamı
- Workers Builds Preview ilk denemesi wrangler.jsonc dosyasında zorunlu previews bloğu bulunmadığı için başarısız oldu. Hata build logundan doğrulandı.
- Canlı DB'den ayrı, ücretli özellik kullanmayan yukvinc-preview D1 oluşturuldu; repo migration'ları izole preview DB'ye uygulandı. Preview'da AI kapalı; üretim D1'i kullanılmıyor.
- wrangler.jsonc içine preview vars, DB ve AI bağları eklendi. İkinci Cloudflare Preview build 2026-10-23 23:19 UTC'de başarılı bitti. Worker Preview URL, hesapta Version/Preview URL devre dışı olduğu için yorumda paylaşılmadı.
- GitHub PR #2, 39ba4b4 commit'i üzerinde açık ve hazır. Cloudflare Preview Build başarılı; GitHub combined status ve Actions workflow API'leri boş durum döndürdü.
- Birleştirme otomatik inceleme tarafından reddedildi: kullanıcı şartı olan yeşil GitHub status/check doğrulanamıyor. Main korunuyor; kontrolü atlatma girişimi yapılmayacak. PR ve geliştirme dalı GitHub'da yayınlanmış durumda.
- Canlı D1 hatası düzeltildi ve yazma/temizleme probe'u doğrulandı. Gerçek kullanıcıyla canlı fotoğraf yükleme testi yapılmadı; üretim hesabı/oturumu kullanılmadı. İstemci ve API akışına ait 10 otomatik test önceki aşamada geçti.
- Sonraki adım: Cloudflare Preview URL'lerini Worker Settings > Domains & Routes > Version URLs üzerinden açarsan Preview uçtan uca test edilebilir. Açılmadan kod değişikliğinin main'e alınması, kullanıcının yeşil GitHub check koşuluna uymuyor.
