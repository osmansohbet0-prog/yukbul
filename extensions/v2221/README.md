# YükVinç V222.1 site içi performans sistemi

Bu klasör, canlı V222 Worker sürümüne eklenen bağımsız modülü ve D1 genişletmesini içerir. GitHub `main` canlı V222 kaynaklarıyla eşleşmediği için bu klasördeki dosyalar `main` üzerine doğrudan `wrangler deploy` edilmemelidir.

- `site-migration.sql`: Var olan kayıtlara dokunmadan ziyaretçi, favori ve etkileşim tablolarını ekler.
- `site-performance.mjs`: Mevcut Worker yanıtlarını saran API ve HTML ekleme katmanı.
- `site-client.js`: Hesabım ve yönetici panelinin mevcut tasarımına eklenen performans arayüzü.
- `site-performance.test.mjs`: Yetki sınırı, tekrar sayımı ve yönlendirme testleri.

V222.1 ilk canlı sürümü 257: `edc07189-3ed2-4908-81e9-4dcb1011b0f7`. İlk geri dönüş noktası sürüm 256: `70f0152e-1676-4539-8f33-5883f8141710`. Eski sürüme geçiş Worker dağıtım oranını eski sürüme %100 ayarlayarak yapılabilir; D1'deki yeni tablolar mevcut veriye zarar vermediği için tutulabilir.

## Profil fotoğrafı düzeltmesi (27 Kasım 2026)

Canlı Worker sürümü `c1ce4909-7638-4691-8085-776bc9c5d074` üç avatar yanıtında D1 BLOB değerini `Uint8Array.from(row.avatar_webp)` ile gerçek resim baytlarına çevirir. Önceden `new Response(row.avatar_webp, ...)` dizi değerini metne dönüştürdüğü için kayıtlı WebP resmi tarayıcıda açılmıyordu. Açık ilanlardaki avatar URL'lerine yeni sürüm sorgusu eklendi ve herkese açık avatar yanıtının önbelleği kapatıldı. Eski performans sistemi sürümü `edc07189-3ed2-4908-81e9-4dcb1011b0f7` geri dönüş noktasıdır.

İlk yüklemede `ASSETS` binding eksik olduğu için ana sayfa hata verdi. Bu yükleme hemen geri alındı; son sürümde `ASSETS` binding açıkça korundu. Canlı ana sayfa, Hesabım, ilan ayrıntısı ve 256×256 WebP görüntüleri yeniden kontrol edildi.

## İlanlarda avatar yerleşimi

`avatar-layout.mjs` ilan sahibi profil fotoğraflarını kartlarda yuvarlak gösterir. İlan ayrıntısında fotoğrafı 52×52 piksel olarak firma adının yanına yerleştirir. Fotoğrafın veri kaynağı ve ilan galerisindeki fotoğraflar değiştirilmez. Bu stil, mevcut `style-src 'self'` güvenlik kuralına uyacak şekilde ayrı bir CSS yanıtından yüklenir.

Canlı Worker sürümü: `a9388d3c-9399-4a01-a206-711f852ddf31`. Önceki çalışan sürüm `c1ce4909-7638-4691-8085-776bc9c5d074` geri dönüş noktasıdır. Gebze Kiralık Vinç ilanında masaüstü ve mobil avatar boyutu, ana sayfadaki ilan kartları ve yatay taşma kontrol edildi.

Ücretli servis, Netgsm ve SMS çağrısı yoktur. Tekil ziyaretçi ve bildirimler takip anahtarı ile bot filtresine bağlıdır. Arama ve WhatsApp sayıları yalnızca tıklamayı gösterir.

