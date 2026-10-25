# İl / ilçe verisi

25 Ekim 2026 tarihinde indirilen sabit kaynak görüntüsü. Çalışan site adres sorgularını üçüncü taraflara göndermez.

- İl/ilçe adları ve ilişkileri: [TurkiyeAPI v2](https://api.turkiyeapi.dev/v2/meta), veri sürümü 2025, metadata `lastUpdated=2026-05-21`, çalışan API `2.0.3`. [İller](https://api.turkiyeapi.dev/v2/datasets/2025/provinces.json), [ilçeler](https://api.turkiyeapi.dev/v2/datasets/2025/districts.json). 81 il, 973 benzersiz ilçe kimliği. Bağımsız açık veri projesidir; resmî devlet servisi değildir. Kaynak açıklamasında ad/kimlik iskeleti TÜİK MEDAS olarak belirtilir. [Kullanım koşulları](https://github.com/ubeydeozdmr/turkiye-api/blob/main/TERMS.md), [MIT lisanslı proje](https://github.com/ubeydeozdmr/turkiye-api).
- Yaklaşık ilçe merkezleri: [Open Admin Data Türkiye](https://github.com/open-admin-data/turkey-administrative-divisions), 19 Haziran 2026 tarihli, CC-BY-4.0. [İlçe verisi](https://github.com/open-admin-data/turkey-administrative-divisions/blob/master/data/all-district.json). © Open Admin Data katkıcıları. Koordinatlar değiştirilmeden sayıya dönüştürüldü; il/ilçe isimleri Türkçe karakter normalleştirmesiyle eşleştirildi. İl adını kullanan merkez ilçeler, TurkiyeAPI'nin `Merkez` kaydıyla eşleştirildi. 973/973 eşleşti, eksik koordinat yok. Bunlar firma kapısının konumu değildir.
- TurkiyeAPI il merkez koordinatları bu pakete dahil edilmedi; yalnızca ikinci kaynaktaki ilçe merkezleri kullanılır.

Kaynağın canlı metadata ve güncel sürüm bilgisi kontrol edildi. İçişleri canlı sayfası bu oturumda alınamadı; tüm idari değişiklikleri resmî kaynaktan bağımsız doğruladığımız iddia edilmez. Yeni ilçe kurulması halinde sabit görüntü kendiliğinden değişmez: kaynak yeniden alınmalı, ad/kimlik sayısı ve ilişki farkı incelenmeli, test/PR kontrollerinden geçerek yayımlanmalıdır. Yeni veri otomatik güvenilerek üretime uygulanmaz.

Testler tüm il/ilçelerin kimlik benzersizliğini, il ilişkisini, koordinat aralığını ve 81/973 kapsamını denetler. İlçe merkezleri `district_center`; yöneticinin kontrol ettiği kesin konum `admin_verified` olarak tutulur. Sadece ikincisi yakın aramaya girer.
