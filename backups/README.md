# YükVinç — CANLI SÜRÜM KURTARMA KAYDI (V222)

**Durum:** 17 Kasım 2026 tarihinde kontrol edildi. Kullanıcının talebiyle eski ana sayfa, admin paneli, iş ilanları, iş talepleri ve İş Radarı için Cloudflare'daki V222 sürümü üretime %100 geri yüklenmişti.

Bu klasördeki `v222-2026-11-17.manifest.json`, **kurtarma için kesin Worker sürüm kimliğini** ve buna eşlik eden domain, rota ve D1 referanslarını korur.

## Geri yükleme noktası

- Platform: Cloudflare Workers
- Canlı Worker: `yukbul`
- Cloudflare sürümü: **V222**
- **Version ID:** `e394c647-c942-4352-9f7f-1f46d88f558a`
- Oluşturulma: **7 Kasım 2026** (UTC `2026-11-07T17:38:39.873186Z`)
- En son eski sürüme geri dağıtım: **17 Kasım 2026, 21.31 Türkiye saati**
- Geri dağıtım ID: `345c0115-0ac1-4174-9967-f1dfaeddccfa`
- Üretimde beklenen trafik: **%100 V222**
- Alan adları: `yukvinc.com.tr`, `www.yukvinc.com.tr`
- D1: `yukvinc-db` — mevcut veriler korunmalıdır.

## Eski sürümü tekrar açmak için

Cloudflare panelinden **Workers & Pages → yukbul → Deployments / Versions** bölümüne gidip **V222 / `e394c647-c942-4352-9f7f-1f46d88f558a`** sürümünü %100 trafiğe dağıt. Daha sonra ana sayfa, `/is-talepleri/`, `/ihale-duyurulari/` ve Cloudflare Access girişinden sonra `/admin/` ile İş Radarı panellerini kontrol et. Eski sayfaların önbelleğinde yeni HTML/JS duruyorsa `yukvinc.com.tr` önbelleğini temizle.

**GitHub'daki `main` dalını doğrudan canlıya dağıtma:** Yeni GitHub kaynakları, V222 Worker/varlık paketiyle tam olarak aynı değildir. Böyle bir dağıtım eski tasarımı ve radar bölümlerini yeniden değiştirebilir.

Sisteme ait orijinal V222 Worker paketi, Cloudflare'ın tarihsel sürüm kayıtlarında tutulur. **Bu dosya, Worker kodunun ve statik varlıklarının ayrı bir dışa aktarımı değildir.** Bu kayıt ayrıca veritabanını kopyalamaz. Cloudflare'daki tarihsel V222 sürümü silinirse yalnızca bu manifestten bire bir kod kurulamaz.

## Korunacak bileşenler

Eski ana site, ilan keşfi, iş talepleri ve talep sahipleri alanı, ihale ekranı ve admin İş Radarı. Cloudflare Access güvenlik katmanını ve mevcut D1 kayıtlarını kaldırma. Overlay ve üçüncü taraf görsel yeniden yazma Worker'larını yeniden ekleme. `yukvinc-radar-sanitizer` ve `yukvinc-seo-settings` için manifestte listelenen beş özel yönlendirme korunur.

## Doğrulama sınırları

Canlı V222 sürümü ve Cloudflare rota yapılandırması doğrulandı; `/is-talepleri/` HTTP 200 yanıtı verir. Tam yetkili admin paneli ve giriş sonrası iş talebi/teklif işlevleri bu kurtarma kaydı oluşturulurken uçtan uca doğrulanmadı.

**Kayıt konumu:** `backup/yukvinc-production-v222-20261117` GitHub dalı. Bu dalı `main`e otomatik birleştirme.
