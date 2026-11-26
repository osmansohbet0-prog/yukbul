# YükVinç V1.2 — Akıllı İhale ve Guardian

## Doğrulanan üretim temeli

- Cloudflare, yukbul Worker sürümü **246** (%100), sürüm kimliği `807265e3-c8b6-4ea4-a39f-a73f3678d4cc`, deployment `2e3fe8b6-bbbe-453b-baab-c7ac1798d7fb`.
- Geri dönüş noktası V1.2’den önceki sürüm 246. Bir önceki 245 de saklıdır. V222 özgün tasarım sürümü olarak saklıdır. V1.2 için üretimde sürüm veya veri değişikliği yapılmadı.
- GitHub main başlangıcı `dafaebd5bd8820bdc92e16143683a8b20613599e`. Canlı Worker sürümünde kaynak commit etiketi yok ve main canlı kopya değil.
- Üretim D1 üzerinde yalnızca şema ve sayım okundu. Kontrol sırasında dokuz gözden geçirilmiş, süresi geçmemiş yayımlanmış ihale kaydı vardı. Mevcut kaynak izinleri, tarama durumu, resmî başvuru kanıtı ve mevcut e-posta tabloları kullanıldı.
- Doğrulanan 246 modül SHA-256 değerleri:
  - university-worker.js `eb0f914c83458779a4837cbea2ddc5717268225c12d87e35ff45faccbd334efc`
  - renewals.mjs `a7c6ebd6224093e18c240d258a606ad75d2e86a1495e49ff88cfbbe76bbc0227`
  - privacy.mjs `a168f6af9c51fb6365df8fb6f19a3292efd0de7da17794696457ba64629f2d4e`
  - _headers `cf82c675269e9581c385d5cf9758621f62dea67e8d45903d8693562fb801eea9`

## Uygulanan bölüm

- `matching.mjs` makine profili, Türkçe ve kg/ton normalizasyonu, kategori ayrımı, asgari/kesin/aralık şartları, açıklanabilir puan ve eksik kanıt uyarısı. Kesin uyumsuzluk puanı sıfırlar. Bilinmeyen zorunlu teknik ayrıntılar yüksek uyumu engeller.
- `tenders.mjs` yalnızca doğrulanmış açık ilanlar, İKN ile deduplikasyon, oturum sahibinin aktif makineleri, kullanıcıya özel kaydetme ve içerik parmak iziyle önbellek. Yayın izni verilen özet kullanılır. Kaynak metni kullanıcıya tekrar yayımlanmaz.
- `board.js` ihale sayfasına yeni, kapatılabilir panel ekler. Varsayılan kişiselleştirme ve makine seçimi, konum/zaman/kayıt filtreleri ve resmî başvuruya bağlantı.
- `advisor.mjs` doğrulanmış kayıt üzerinden kural tabanlı başvuru kontrol listesi. İsteğe bağlı Workers AI yalnızca sabit kontrol maddelerinin sırasını düzenler. AI arızasında kurallar kullanılır. Canlı modele dokümanda olmayan hukuki şartlar ürettirilmez.
- `notifications.mjs` ayrı uygulama içi ve e-posta tercihleri, tekil gönderim kaydı, sınırlı tarama, açıkça yeniden denenebilir hata için artan bekleme ve belirsiz teslimatın yeniden gönderilmemesi.
- `guardian.mjs` D1, radar, yayındaki ihaleler, eşleşmeler, mevcut ihale e-posta kuyruğu ve yenileme tablolarına dayanan sağlık denetimleri. Süre, açık/kapanmış olay kaydı, kaynak tarama durumu ve yönetici API’si. `guardian-ui.js` Kullanım bölümüne ayrı panel ekler.
- `worker-overlay.mjs` mevcut Worker’a yalnızca kendi yol ve izinlerini ekler. `integrate.py` tam Worker 246 modülüne eklenti girişini yerleştirir. Ana sayfa, mevcut yönetim paneli, gezinme ve CSS dosyaları düzenlenmedi.
- `migration.sql` 9 yeni tablo ve 3 indeks ekler. Mevcut tabloları yeniden yazmaz. `v12.test.mjs` SQL ve Worker yönlendirme sınırlarını yalıtılmış veriyle doğrular.

## Yalıtılmış test

Node 24+ ile `node --test v12.test.mjs`. Eşleştirme, hesap ayrımı, kayıt, iptal ve süre kontrolü, doküman bağlantısı, AI arızası, Guardian kilidi, başarısız e-posta ve tekillik test edilir. Kodda tersine çevrilebilir özellik anahtarları kullanılır.

Önizleme kurulumu için 246’nın birebir koduna `python integrate.py university-worker.mjs university-v12.mjs` ile giriş modülü üretin. Çıktıyı, diğer V1.2 modüllerini ve 246'nın doğrulanmış renewals/privacy modüllerini mevcut statik dosyalarla birlikte paketleyin. Yeni SQL’i **yalıtılmış D1** üzerinde çalıştırın. Üretimden kullanıcı satırlarını kopyalamayın. İlk olarak `V12_TENDERS_ENABLED` ve `V12_GUARDIAN_ENABLED` ile deneyin. `V12_ALERTS_ENABLED`, `V12_AI_ENABLED` ve `V12_AI_MODEL` ayrı doğrulanmalıdır. Kimlik doğrulamalı yönetim API’si mevcut Cloudflare Access ve uygulama oturumunu kullanır.

## Ölçek ve maliyet

- 100 kullanıcı: mevcut D1 ve küçük veri kümesiyle pilot yapılabilir. Veri ve API ölçümleri esas alınır.
- 1.000 kullanıcı: önbellek geçersizleştirme ve Cron kuyruk gecikmesi ölçülmeli. İstek başına üst sınır 80 ihale / 25 makine. Aynı veriyle tekrar açılışta puanlar yeniden hesaplanmaz.
- 10.000 kullanıcı: altı kullanıcı/dakika üst sınırında bütün izinli kullanıcıları taramak yaklaşık 28 saat sürer. Üretim öncesi ilan/ihale sürümüne göre değişen çiftleri kuyruklamak ve kategori/konum önseçimi gerekir.
- 100.000 kullanıcı: aynı tarama şekli yaklaşık 11,6 gün sürer. Kullanıcı bazlı tarama yerine değişim odaklı, bölümlenmiş kuyruk ve yük testi gerekir.
- Yerel ölçümde önceden ayrıştırılmış 2.000 saf eşleştirme yaklaşık 4,7 ms medyan ve 9,8 ms p95. Buna SQL, HTTP, AI ve UI dahil değildir. Bazı Cloudflare planlarında sorgu sınırı nedeniyle Cron altı üyeyle sınırlandı.
- V1.2 için yeni ücretli hizmet başlatılmadı. İlk pilotta AI kapalı tutulmalıdır. D1 okuma/yazma ve Workers CPU ölçülmeden aylık fatura tahmini verilemez. [D1 tarifesi](https://developers.cloudflare.com/d1/platform/pricing/) · [Workers AI tarifesi](https://developers.cloudflare.com/workers-ai/platform/pricing/)

## Canlı yayından önce eksik

- Gerçek çalışan Cloudflare önizlemesi, masaüstü/mobil görsel karşılaştırması, oturumlu yönetici testi, Google OAuth, gerçek e-posta ve canlıya benzer D1 yük testi tamamlanmadı. Üretime geçilmedi.
- İhale kayıtları için mevcut radar yeniden kullanılıyor. Yeni kurumsal kaynaklar, tam doküman/PDF ayrıştırma ve otomatik iptal kaynağı eklenmedi. Güvenli olmayan veya belirsiz teknik bilgiler doğrulanmış sayılmaz.
- Mevcut önbellek değişiklikte üye matrisini yeniden hesaplıyor. Tam artımlı çift kuyruğu ve sayfalı katalog henüz yok. “Yakınımdaki” ilan illerini kullanır.
- Guardian’ın kapsamı kısmi. Sentetik Google oturumu, fotoğraf teslimi, uçtan uca yayın/yenileme, haricî API gecikmesi, hata oranı ve depolama ölçümü, yedekleme zaman damgası, tam kurtarma akışları ve otomatik GitHub issue bu sürümde yok. Belirsiz e-posta teslimatı tekrar denenmez.
- Mevcut ihale e-posta akışı ile yeni tercihlerin çift gönderim oluşturmaması, gerçek bildirimler etkinleştirilmeden doğrulanmalı. Kazara birden fazla kanaldan e-posta gönderilmemesi için her iki sistem de önizlemede birlikte denenmeli.
