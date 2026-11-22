# YükVinç kaynak sitesi incelemesi

İnceleme tarihi: 18 Kasım 2026

## Kaynak ve tarama kararı

- Kaynak site: https://yukvinc.com.tr
- Ana sayfa ilanları HTML olarak yayımlıyor; ilan detayları ayrı `/ilan/{id}/{slug}/` yollarında.
- `robots.txt` genel sayfa taramasına izin veriyor, ancak `/api/` yollarını tüm botlara kapatıyor. Site ayrıca kendi `sitemap.xml` dosyasını bildiriyor.
- Bu uygulama aynı YükVinç sisteminin birinci taraf istemcisi olduğundan ilanları kopyalayan bir scraper kurulmayacak. Mevcut, yetkilendirilmiş JSON API ve D1 verisi kullanılacak. İstekleri sık aralıklarla başka bir sayfayı tarayarak çoğaltmak gereksiz yük ve çift kayıt riski oluşturur.
- Mevcut sistem Cloudflare Workers/Pages ve D1 kullanıyor; ikinci bir PostgreSQL veritabanı açmak web ve mobil arasında veri ayrışması yaratır.

## Gözlenen ilan arayüzü ve veri

Ana sayfada şu kategoriler var: vinç, mobil lastikçi, oto kurtarıcı, sepetli platform, manlift, iş makineleri, nakliyat asansörü ve operatör ilanları. Kartlarda başlık, açıklama özeti, il/ilçe, fiyat/ücret bilgisi, ilan sahibi ve iletişim bağlantıları görünüyor.

İlan detayında kategori, il/ilçe, son güncelleme, açıklama, fotoğraflar, arama/WhatsApp, paylaşma, benzer ilanlar ve bildirim işlevi bulunuyor. Onaylı ilanlar doğrudan herkese açık.

Mevcut public API sözleşmesi `GET /api/listings`, filtre olarak `q`, `category`, `city` kabul ediyor; detay için `GET /api/listings/{id}` ve görseller için `/api/listing-photo/{id}` var. API'de marka, model ve yıl alanları görünmedi; mevcut kayıtta yoksa uygulama bunları uydurmamalı. Bu geliştirme dalında geriye dönük uyumlu `limit` + `cursor` sayfalaması eklendi.

## Yayın öncesi doğrulanması gerekenler

- Ana sayfada kullanım koşulu bağlantısı bulunamadı.
- `/gizlilik/` sayfası gerçek veri sorumlusu/unvan/adres ve saklama süresi gibi alanların tamamlanması gerektiğini açıkça söylüyor; metin nihai değil.
- Anlık bildirim için mevcut backend'de FCM cihaz kaydı ve gönderim akışı yok. Push için Firebase proje yapılandırması ve sunucu tarafı gizli anahtar gerekir; mobil APK içine gizli anahtar konmayacak.
- Her yeni onaylı ilanı bildirmek için uygun tetikleyici, istemci tarafı tarama değil, ilan onaylandığında backend'den FCM gönderimi olmalı.
