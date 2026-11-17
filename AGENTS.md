# YükVinç - Kod ajanları için çalışma kuralları

Bu depo canlı YükVinç uygulamasının kaynak kodudur. Buradaki talimatlar OpenCode ve AGENTS.md okuyan diğer kod ajanları içindir.

## Mimariyi önce incele
- Cloudflare Workers giriş noktası: `src/worker.js`; statik arayüz: `public/`; yardımcı API modülleri: `functions/`; D1 şeması: `migrations/`.
- Testler: `tests/`; çalıştır: `npm test`, ayrıca `node --check src/worker.js`.
- Önce `KURULUM.md`, `package.json`, `wrangler.jsonc` ve değiştirilecek dosyaları oku. Dosya adları ve mevcut API sözleşmeleri üzerinden ilerle; mimariyi varsayma.

## Değişmez güvenlik sınırları
- `main` canlı siteye dağıtım tetikleyebilir: doğrudan main'e commit atma, otomatik merge/deploy yapma. Her işi ayrı feature dalında ve PR ile sun.
- API anahtarı, oturum çerezi, OAuth sırrı veya kullanıcı verisini koda, loglara, PR'a ve GitHub'a yazma. `EVREN_LLM_API_KEY` yalnızca yerel ortam değişkeni / güvenli secret deposunda bulunmalı.
- D1 veritabanını silme/sıfırlama. Veritabanı migration'larını otomatik uygulama. Veri kaybı doğuracak SQL için insan onayı al.
- Giriş/kayıt/Google ile oturum açma, ilanlar, telefon/WhatsApp bağlantıları, yönetici paneli ve mobil API uyumluluğu korunmalı.
- Cloudflare, Google Ads, dış servisler ve canlı kullanıcılar üzerinde yetkisiz işlemler yapma. Ücretli kaynak/harcama başlatma.

## Geliştirme öncelikleri
1. Hataları tekrarlanabilir testlerle tespit et; kök nedeni düzelt.
2. Web ve Android aynı API/veri kaynağını kullansın; filtre, konum, üyelik, fotoğraf, ilan ekleme ve düzenleme akışlarında tutarlılığı koru.
3. Kullanıcı arayüzünü mobil öncelikli, hızlı, erişilebilir ve Türkçe olarak geliştir; mevcut işlevleri kaldırma.
4. Kod değişiklikleri küçük ve denetlenebilir olsun. Eksik API veya veritabanı alanı gerekiyorsa geriye uyumlu geçiş planı yaz.
5. Değişiklik sonunda test sonuçlarını, riskleri, değişen dosyaları ve gerekiyorsa elle yapılacak adımları Türkçe raporla.

## İş tamamlama kriteri
Yalnızca kod yazmayı tamamlanmış sayma. Testleri çalıştır, başarısızlıkları ve test edilemeyen akışları açıkça raporla; canlı yayın için ayrıca onay iste.
