# Türkiye Radar ve üyelik gizliliği — V180

2 Kasım 2026. Değişiklikler canlıya dağıtıldı; yalnızca öneri veya prompt değildir.

- Canlı `yukbul`: V180, `bfcb9e1b-edba-4491-9551-bfd62e60594c`, trafik %100.
- Staging: V35, `c7fd9b1e-d3cd-4a37-badb-e548b76c279c`.
- Canlı geri okuma SHA-256: `9e4705f07d1b3b086d0e2111e83ba85dcf395663311d010a828399fe7fdebaab`.
- Geri dönüş: V179, `cbde516c-94ba-4dd6-bc43-667d3f96495c`.

Üye olmayanlar iş taleplerinde yalnızca şehir/hizmet türünden oluşan kısa başlık ve üyelik çağrısı görür. Açıklama, iletişim, kurum adı, özgün ilan başlığı, ilan kimliği ve kaynak URL'si anonim API yanıtına eklenmez. İş kartında ihale veya dış kaynağa git düğmesi bulunmaz. Ayrı ihale sayfası da ziyaretçiye kaynak bağlantısı vermez. İş talepleri sayfasındaki eski Kocaeli personel ilanı kartı kaldırıldı.

Mobil kartlar kompakt hale getirildi. Canlıdaki 7 kart telefon görünümünde incelendi: belge genişliği 375 piksel, içerik genişliği 375 piksel; kartlar sağ kenarı 359 piksel. Yatay taşma ve tarayıcı hatası gözlenmedi. Masaüstü yerleşimi korunur.

İlan listeleri ve galerideki küçük görseller önizleme kullanır. Fotoğraf API'si önizleme istendiğinde D1'den ayrıca özgün büyük fotoğrafı taşımaz. Önizlemesi bulunmayan eski fotoğraflar özgün dosyaya düşer; fotoğraflar silinmedi/değiştirilmedi. Örnek ilanlarda önizlemeler 337.282 bayt yerine 13.244 bayt, 223.678 bayt yerine 14.420 bayt döndü. Canlı örnek ilan fotoğrafı tarayıcıda 1254×1254 piksel olarak açıldı. Kontrol edilen 19 açık ilan fotoğrafı HTTP 200 döndü; veritabanında 25 fotoğraf ve 0 eksik özgün BLOB korundu. Eski önizlemesi olmayan 7 fotoğraf için toplu üretim yapılmadı.

81 il ve 973 ilçede mevcut iş talebi formu korunur. İsteğe bağlı mahalle/OSB/şantiye bölgesi alanı eklendi; kaydedilen açıklamada saklanır. Manito/telehandler, manlift ve vinç alıcı ifadeleri sınıflandırmaya dahil edildi. Kaynak paneli aynı yerde, başlangıçta kapalıdır; basınca kaynaklar aşağı doğru açılır.

Türkiye Belediyeler Birliği'nin resmî dizini yeniden indirildi ve 81 ilde 929 belediye bağlantısı doğrulandı. Bunlar admin kataloğunda il seçilince gösterilir; ilçeler ve mahalle/OSB için vinç, manlift, manito ve makine indirme sorguları oluşturulur. 973 ilçenin tamamının otomatik çalışan belediye kaynağı olduğu iddia edilmez. Dizin bazı ilçeler için ayrı doğrulanmış web bağlantısı içermeyebilir. Kaynak arama bağlantıları, otomatik çalıştırılan arama API'si değildir. Kaynak erişimi ve yayın yetkisi doğrulanmadan tarama/yayın açılmaz.

Otomatik yayın politikası: sınıflandırma güveni kesin olarak %90 üzerinde; gerçek alıcı ve açık hizmet alımı; izinli ve etkin kaynak; aynı yayıncıda güncel yeniden yayın hakkı; son 24 saatte kaynak yayını; asıl sayfa/başlık eşleşmesi; geçmemiş ve sayfada doğrulanmış teklif tarihi; satın alma, reklam, personel ve iletişim bilgisi filtreleri. Uygun kamu alımı kaydı otomatik yayımlanır; eksikler incelemede kalır. %90 tek başına yeterli değildir. Son tarihi bilinmeyen piyasa talepleri bu otomatik ihale akışında yayımlanmaz.

Gerçek kapasite sınırı: üretimde 56 kayıtlı kaynak, 32 etkin tarama kaynağı vardır; doğrulanmış güncel yeniden yayın izni bulunan kaynak sayısı 0. Bu nedenle yeni politikayla gerçek otomatik yayın yapıldığı veya Türkiye'nin bütün sitelerinin otomatik tarandığı iddia edilmez. Kocaeli'de doğrulanmış çalışan otomatik kaynak hâlâ 0. 929 belediye bağlantısı bu sayılara etkin kaynak olarak eklenmedi.

Sahibinden'in yayımladığı API, kurumsal mağazanın kendi verilerini yetkili aktarmasına yöneliktir. Genel ilan arama/telefon toplama yetkisi bulunmadığından otomatik telefon çekme açılmadı. Oturum/erişim engelleri aşılmadı. Ziyaretçi iş kartları Sahibinden'e yönlendirilmez. EKAP, ilan.gov.tr, Makina Parkuru ve açık API dokümanı yayımlayan alternatifler araştırıldı; doğrulanmamış kaynaklar çalışıyor diye gösterilmedi.

300/300 test geçti. Ek kontroller: anonim API/HTML'de ayrıntı ve bağlantı sızıntısı yok; kaynak kataloğunda 81 il doğrulaması; ilçe/mahalle sorgusu doğrulaması; %90 ve altı otomatik yayın reddi; izinsiz/eski/satın alma kayıtlarını ret; uygun %91 kaydını yerel kontrollü fixture'da otomatik yayın; önizleme/özgün fotoğraf geri dönüşü ve gizli fotoğraf koruması. Otomatik yayın testi gerçek müşteri ilanı yaratmadan yerelde yapıldı.

Canlıda mevcut 45 dosya adresi 200; `/api/radar` oturumsuz 401; `/api/jobs`, `/is-talepleri/`, `/ihale-duyurulari/`, `/api/saglik` 200. Worker kodu SHA-256 ile geri okundu. Bağlar ve ASSETS ayarları V179 ile birebir karşılaştırıldı. İş verisi için üretim migration veya toplu veri değişikliği yapılmadı; mevcut 8 Radar kaydı ve 7 yayımlanmış kayıt korundu.

Kaynaklar:

- https://www.tbb.gov.tr/tr/buyuksehir-ve-il-belediyeleri
- https://yardim.sahibinden.com/hc/tr/articles/19780244786460-API-Kullan%C4%B1m%C4%B1-ile-Veri-Transferi
- https://www.sahibinden.com/sozlesmeler/ek-1-kullanim-kosullari-37
- https://www.kimbulur.com/gelistirici
- https://birmakine.com/gelistirici
