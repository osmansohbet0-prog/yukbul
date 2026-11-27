# YükVinç V222.1 site içi performans sistemi

Bu klasör, canlı V222 Worker sürümüne eklenen bağımsız modülü ve D1 genişletmesini içerir. GitHub `main` canlı V222 kaynaklarıyla eşleşmediği için bu klasördeki dosyalar `main` üzerine doğrudan `wrangler deploy` edilmemelidir.

- `site-migration.sql`: Var olan kayıtlara dokunmadan ziyaretçi, favori ve etkileşim tablolarını ekler.
- `site-performance.mjs`: Mevcut Worker yanıtlarını saran API ve HTML ekleme katmanı.
- `site-client.js`: Hesabım ve yönetici panelinin mevcut tasarımına eklenen performans arayüzü.
- `site-performance.test.mjs`: Yetki sınırı, tekrar sayımı ve yönlendirme testleri.

Canlı sürüm 257: `edc07189-3ed2-4908-81e9-4dcb1011b0f7`. Geri dönüş noktası sürüm 256: `70f0152e-1676-4539-8f33-5883f8141710`. Eski sürüme geçiş Worker dağıtım oranını eski sürüme %100 ayarlayarak yapılabilir; D1'deki yeni tablolar mevcut veriye zarar vermediği için tutulabilir.

Ücretli servis, Netgsm ve SMS çağrısı yoktur. Tekil ziyaretçi ve bildirimler takip anahtarı ile bot filtresine bağlıdır. Arama ve WhatsApp sayıları yalnızca tıklamayı gösterir.

