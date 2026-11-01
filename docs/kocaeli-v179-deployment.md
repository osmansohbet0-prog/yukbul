# YükVinç Kocaeli Radar — gerçek dağıtım sonucu

2 Kasım 2026, Europe/Istanbul. Entegrasyon canlıya dağıtıldı ve geri okundu.

- Canlı: yukbul V179, cbde516c-94ba-4dd6-bc43-667d3f96495c, trafik %100.
- Staging: yukbul-staging V33, 9193ccd9-89b8-42b7-8244-f7318f02eeda, trafik %100.
- Geri dönüş sürümü: canlı V178, 1b6adbd7-41b7-4d33-8a53-496c2b4594b0.
- V178 kaynak haritasından 101 modül geri çıkarıldı. Yeniden derlenen başlangıç paketi canlı V178 ile birebir aynı: SHA-256 526e11c236f3e749007c5bd0caabac04638ad0b69989c63086747ace28304cfb.
- Canlı V179 kodu geri okuma SHA-256: 8b42ef38ec57313c11778a74ebaebc6228622b30d208006a44387e5d4fa6253a.
- Staging V33 kodu geri okuma SHA-256: d906588bf8da80bc185d61880353e8e7d1d8fc7643a886edbbc1211277a1da38.

## Uygulanan akış

/api/radar mevcut requireAdmin oturum denetimini kullanır. Kocaeli izinli kaynak taraması gerçek scanLeadRadar işleyicisine bağlıdır. Zamanı gelen kaynaklarda Kocaeli önceliği vardır; pasif/manual_only kaynaklar çalıştırılmaz. 96 sorguluk plan admin panelinde açılabilir arama bağlantılarıdır; otomatik arama API'si yapılandırılmadı ve bu bağlantılar otomatik tarama sayılmaz.

Satın alma, personel ve reklam filtreleri taramada ve kamusal Radar gösteriminde uygulanır. Kocaeli AI taslağı için asıl sayfanın açık yayın zamanı son 24 saat içinde doğrulanır; indekslenme veya yönetici girişi yayın tarihi yerine kullanılmaz. AI taslağı mevcut revizyon, kaynak hash'i, yayın hakkı, geçerli son teklif tarihi ve insan Onayla ve Yayımla kontrolünden geçer. Tarihsiz talep yayına çıkmaz. Mevcut ulusal ilanlar korunur.

Kurumsal telefonlar ve kaynak kanıtları yalnızca yönetici Radar verisindedir. Üç geçmiş/belirsiz kurumsal kayıt canlı yönetici ekranında doğrulandı; güncel vinç işi olarak etiketlenmedi. /api/jobs bu tablodan iletişim okumaz. Otomatik arama, e-posta veya mesaj gönderilmedi. Yeni Kocaeli sayfası oluşturulmadı.

## Doğrulama

296/296 test geçti. Uçtan uca testler: gerçek oturum doğrulaması, üye/anonim ret, çapraz kaynaklı yazma ret, pasif kaynakta sıfır ağ isteği, yayın tarihini doğrulama, AI taslak revizyonu, yayın izni, eski kaynak engeli, insan onayı ve kamusal telefon gizliliği.

Staging Cloudflare Access korumasıyla mevcut yönetici oturumundan açıldı; Radar, Kocaeli düğmesi ve iletişim kayıtları doğrulandı. Korumalı staging'e oturumsuz ağ istekleri 302 döner; koruma kaldırılmadı. Aynı paket yerel Cloudflare ortamında 44 statik/dinamik dosya adresiyle karşılaştırıldı: 42 aynı, Radar JS amaçlı değişik, offline HTML altbilgisi yerel boş DB ile farklı. Üretimde 45/45 mevcut dosya adresi 200 döndü. Dinamik sitemap ayrıca 200.

Canlı /api/radar oturumsuz 401 ve no-store; /api/jobs, /is-talepleri/, /ihale-duyurulari/ ve /api/saglik 200. Kurumsal telefon sızıntısı ve 2026/2071046 satın alma kartı bulunmadı. Canlı yönetici panelinde Radar ve üç telefon kaydı açıldı; tarayıcı hata günlüğü boş.

Canlı Worker bağları ve ASSETS ayarları V178 ile birebir karşılaştırıldı ve korundu. Üretim D1'de bu çalışma kapsamında şema/veri mutasyonu yapılmadı. Geri okumada 56 kaynak, 32 etkin kaynak, 8 Radar kaydı, 7 yayımlanmış Radar kaydı ve 3 kurumsal iletişim kaydı korundu. 004/005 veri yapıları zaten mevcut olduğundan tekrar kaynak eklenmedi. Preview DB 67 kaynak içerir; üretimle aynı kaynak sayısı iddia edilmez.

## Gerçek sınır

Kocaeli için doğrulanmış çalışan ve izinli otomatik kaynak hâlâ 0. Yeni pasif kaynaklar etkin sayılmadı. Doğrulanmış güncel Kocaeli kiralama fırsatı bulunmadı; sahte ilan eklenmedi. Arama planı ve entegrasyon hazır olsa da yetkili çalışan kaynak/API olmadan sosyal medya ve web genelinde otomatik müşteri bulduğu söylenemez.

Preview tam SQL yedeği yerelde açıldı ve integrity_check=ok: SHA-256 2fc18c65dc82c9218e04376b0e9daa15552fd204c0182ffa6f4d715de6b47803. Yedek özel veri içerdiği için teslim veya GitHub paketine eklenmedi. Otomatik onay denetimi, tam üretim yedeğinin özel kullanıcı verileri nedeniyle bilgisayara indirilmesini reddetti; üretim yedeği indirilmedi ve bu engel dolanılmadı. Cloudflare sunucusunda oluşturulan geri yükleme/export bookmark: 000000bb-000007dc-00005116-378754c6885ff46ea31eeb3683b23a28. Veritabanı geri yüklemesi yapılmadı.

GitHub main veya PR #61 birleştirilmedi. Çalışma integration/kocaeli-v178-20261102 dalında canlı kaynakları ve doğrulama kanıtıyla saklanır. Gelecekte dağıtımda bu V178 kökenli paket temel alınmalı; eski main doğrudan dağıtılmamalıdır.
