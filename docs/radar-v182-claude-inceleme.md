# Claude önerilerinin uygulanması — 2 Kasım 2026

İlk üç bölüm mevcut Cloudflare/D1 Radar'a uygulandı. Yeni bir uygulama veya veritabanı kurulmadı. Canlı Worker **V182**, staging **V37**. Sonraki aşamaların tamamlandığı veya yeni müşteri bulunduğu iddia edilmez.

## Teşhis ve uygulanan düzeltmeler

1. Belediye bağlantısı, çalışan okuyucu ve yeniden yayın izni birbirine karışabiliyordu. Admin'de 81 il için ayrı kayıtlı/izinli/çalışan/yayına hazır kaynak sayıları getirildi.
2. Firma reklamı ve operatör ilanı talep sanılabiliyordu. Türkçe ön filtre, ekipman belirlenmiş reklam ve personel içeriklerini AI çağrısından önce eliyor.
3. Proje, şirket ve yatırım bilgileri gerçek talep değildir. Altı sinyal katmanı tanımlandı; yalnız doğrudan talep ve uygun hizmet ihalesi yayın adayı olabilir.
4. Tonaj ve konum çıkarımının sınırı belirsizdi. Birimli tonaj aralığı, ekipman türü ve konum kanıtı çıkarılıyor; belirsizlikler açıkça gösteriliyor.
5. Kaynak izni ve güncellik, metinden varsayılamaz. Ön analiz hiçbir kayda izin, doğrulanmış tarih veya otomatik yayın yetkisi vermiyor.

## Admin'de kullanımı

İş Radarı ekranında kapanabilir **Metni ön incele — talep mi, reklam mı?** bölümüne metin girilebilir. Analiz kaydetmez/yayımlamaz, dış hizmet veya AI çağırmaz. Başlık, güvenli kaynak adresi, ekipman, tonaj, konum kanıtı ve eksik doğrulamalar gösterilir. Mevcut 81 il kapsam bölümünden il tablosu, kaynaklar bölümünden sinyal rehberi isteğe bağlı açılır. Yeni kamusal sayfa oluşturulmadı.

Türkçe analiz; doğrudan talep, reklam/arz, personel, proje, ilgisiz ve belirsiz metinleri ayırır. Mobil/sepetli/kule/paletli/hiab vinç, manlift/platform ve telehandler terimleri desteklenir. 25–40 ton, 100t ve 2,5 ton gibi birimli ifadeler ayrıştırılır; telefon, tarih ve birimsiz fiyat tonaj sayılmaz. 1–10 niyet gücü bir başarı yüzdesi değildir. Başarı oranı henüz gerçek etiketli veriyle ölçülmedi.

## Kaynak ve sinyal haritası

| Kaynak | Kullanım | Durum / sınır |
|---|---|---|
| [Belediye dizini](https://www.tbb.gov.tr/tr/buyuksehir-ve-il-belediyeleri) | Kurum kaynaklarını keşfetme | 929 bağlantı çalışan kaynak demek değildir; her kurum izni ayrı |
| [EKAP](https://ekapv2.kik.gov.tr/ekap/search) | Hizmet alımı talebi | Genel desteklenen API ve yeniden yayın hakkı doğrulanmadı |
| [ilan.gov.tr](https://www.ilan.gov.tr) | Resmî ihale duyuruları | Bu kontrolde zaman aşımı; otomatik erişim/yayın hakkı doğrulanmadı |
| [EPDK servisleri](https://www.epdk.gov.tr/Detay/Icerik/3-0-226/web-servisler) | Enerji projesi sinyali | Servis kataloğu var; yetkili çağrı ve yeniden kullanım doğrulanmadı; doğrudan talep değildir |
| [ÇED](https://eced-duyuru.csb.gov.tr/eced-prod/duyurular.xhtml) | Proje öncü sinyali | Bakanlık bağlantısı doğrulandı, portal zaman aşımı; API/yayın hakkı doğrulanmadı |
| [OSB duyuruları](https://geposb.com.tr/tr/duyurular) | Satın alma veya yatırım duyurusu | Kurum bazında teyit; yatırım haberi talep değildir |
| [Ticaret Sicili](https://www.ticaretsicil.gov.tr/index2.php) | Şirket doğrulama | Toplu API/reuse doğrulanmadı; kişisel ortak/yönetici toplama yok |
| [OpenStreetMap](https://www.openstreetmap.org/copyright), [Places](https://developers.google.com/maps/documentation/places/web-service/policies) | Kurumsal zenginleştirme | Lisans, saklama ve atıf koşulları uygulanmalı; talep kanıtı değildir |
| İzinli e-posta bildirimleri ve resmî sosyal API'ler | Yetkili talep sinyali | E-posta geliş zamanı özgün yayın tarihi sayılmaz; yetki ve özgün tarih gerekir |

Rehber hiçbir yeni okuyucuyu etkinleştirmiyor. Günlük kontrol yalnız izin ve hız sınırı doğrulanınca bir öneridir; kaynak başına gerçek hacim, maliyet ve başarı oranı ölçülmedi. Topluluk İhale MCP erişim yaklaşımı bu oturumun erişim sınırlarıyla uyuşmadığından entegre edilmedi.

## Gerçek kapsam

81 il, 973 ilçe ve 929 belediye bağlantısı katalogda. 56 kaynak kaydı, 32 etkin kaynak var. Son çalışma/izin kayıtlarına göre **57 ilde çalışan okuyucu yok**, **81 ilde yayına hazır kaynak yok**. Kocaeli için doğrulanmış çalışan kaynak hâlâ 0. İl kapsamı belirtilmemiş 5 kaynak Türkiye geneline otomatik dağıtılmadı. İl satırlarının toplamı benzersiz ulusal kaynak sayısı değildir.

Ayrıntılar: [81 il tablosu](radar-81-il-kapsam.md). Yeni kaynakların izin ve gerçek veri testleri tamamlanmadan kapsam kazanılmış sayılmaz.

## Doğrulama ve dağıtım

- 345/345 test geçti. Yeni analiz, kapsam, yetkisiz erişim, farklı origin, boyut sınırı ve sahte doğrulama bayrakları test edildi.
- 44 statik URL yerel staging ile karşılaştırıldı. Admin betiği beklenen değişiklik; offline sayfasındaki fark yerel boş veritabanı alt bilgisidir. Tüm yanıtlar 200.
- Staging V37: `52a4cabe-28c6-4ead-b657-a22887d65a10`; kaynak SHA256 `8757226b0f0c4dfbd91149e2e4b1a0c871ffc2c0ca7b6869047c85bcfab50560`.
- Canlı V182: `cc2f8c0b-ce7b-4cf0-befe-ecef9574416e`, %100; dağıtım `450290f6-91f1-439f-b8b0-efa05fceed21`.
- Canlı kaynak SHA256 `987cd78bfbd05bbc5b0d149fb9fde77e02a19114034ee3928f67fcc77c6984f7`; yerel paketle aynı. Önceki sürümle bindings ve statik assets ayarları birebir karşılaştırıldı.
- Canlı 45 statik dosya 200; `/api/radar` anonim 401, eski admin yolu 302. İlan ve ihale sayfaları 200; anonim yanıtlarda iletişim sızıntısı bulunmadı.
- D1'de 8 kayıt korundu: 7 approved, 1 dismissed. Veritabanı değişikliği veya veri aktarımı yapılmadı.
- Yönetici arayüzü yerel testlerle kontrol edildi; canlı tarayıcıda oturum açılarak görsel kontrol yapılmadı. Staging Access koruması aşılmadı.

## Sınırlar ve sonraki adımlar

Kaynak izinlerini tamamlayıp tek gerçek kaynakla uçtan uca talep testi yapmak öncelikli. Ardından etiketli gerçek örneklerle hassasiyet ölçümü ve filoya uygunluk değerlendirmesi yapılabilir; filo ve bütçe bilgisi tahmin edilmedi. Prompt'un sonraki 4–10 aşamaları bu sürümde tamamlanmadı.

Telefonlar mevcut admin korumasında kaldı. Sahibinden için yetkisiz telefon toplama açılmadı. Otomatik mesaj gönderimi yok. İletişim bulmak izin anlamına gelmez; [KVKK'nın alenileştirme açıklaması](https://www.kvkk.gov.tr/Icerik/6843/-ALENILESTIRME-HAKKINDA-KAMUOYU-DUYURUSU) ve [İYS koşulları](https://iys.org.tr/iys/sss) amaç, kanal ve ret durumuna göre değerlendirilmelidir.
