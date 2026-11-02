# Tıbbi Laboratuvar İş İlanları — canlı sonuç

2 Kasım 2026 tarihinde admin paneline ayrı **Tıbbi Laboratuvar İş İlanları** sekmesi eklendi. Kapsam: laborant, tıbbi laboratuvar teknikeri ve teknisyeni personel alımları. Cihaz/malzeme alımları ve akademik kadrolar bu kapsama alınmadı.

## Kullanım

Admin panelinde yeni sekmeyi açın. Varsayılan görünüm **Doğrulanmış açık ilanlar**. İl filtresi 81 ili içeriyor. Ayrı filtrelerde doğrulanamayan, süresi dolmuş ve elenmiş kayıtlar görülebilir. Kartlarda kurum/kaynak, pozisyon, konum kanıtı, son başvuru, son kontrol, kaynak bağlantısı ve AI inceleme durumu var.

Kaynaklar bölümü kapanabilir. Burada son tarama, hata durumu, açma/kapama ve izinli kurum/üniversite kaynağı ekleme bulunur. Bağlı kaynaklar 6 saatlik aralıklarla kontrol edilir; “Kaynakları tara” aynı aralık ve kilit kurallarını uygular. Tüm kaynakları aynı anda zorla taramaz; sıradaki uygun kaynağı işler. Mevcut dakikalık zamanlayıcı bu işlemleri sırayla yürütür.

## Doğrulama kuralları

- Son başvuru tarihi kaynak metnindeki açık etiketten veya tekil JobPosting kaydından çıkarılır. Çelişen, belirsiz veya geçersiz tarih açık ilan sayılmaz. Tarihler Türkiye saatine göre değerlendirilir.
- Son tarihi geçmiş, henüz başlamamış, 180 günden uzak tarihli veya son kontrolü 24 saatten eski kayıtlar açık görünmez. Yeniden okunamayan kayıt doğrulanamayan durumuna geçer.
- Sonuç, yedek aday, genel CV, akademik personel, cihaz/malzeme alımı ve tıbbi olmayan laboratuvarlar elenir.
- Workers AI mevcut kaynak kanıtlarından seçim yapar; tarih, işveren veya yeni ilan üretemez. Şemalı yanıt ve kanıt indeksi kontrol edilir. Model sonucu ilan açıklığını tek başına belirleyemez. Hatalı AI yanıtı kabul edilmez; yeni kaynak okuması olmadan bir sınırlı tekrar yapılabilir, bu tekrar doğrulama zamanını yenilemez veya kaydı açık duruma yükseltmez.
- Mevcut günlük AI bütçesi korunur: bu iş için en çok 12, uygulama toplamında en çok 30 çağrı/gün. Hatalı çağrılar da bütçeden sayılır.
- Kaynak erişimi HTTPS kurum/üniversite alan adlarıyla sınırlı; robots kuralları her okumada kontrol edilir. Oturum/koruma/yönlendirme engelleri aşılmaz. Boyut, zaman ve aday sayısı sınırları vardır.

## Gerçek tarama sonucu

[Kapadokya Üniversitesi Kariyer](https://kariyer.kapadokya.edu.tr/is-ilanlari/) ve [Gazi Üniversitesi Personel Dairesi](https://personel.gazi.edu.tr/) başarıyla okundu. İki kaynak da canlıda `ok` durumunda.

- 6 aday bağlantı incelendi.
- 5 ilgisiz personel ilanı elendi.
- Anadolu OSGB laboratuvar teknikeri duyurusu AI tarafından kaynak kanıtıyla incelendi; son başvuru tarihi doğrulanamadığından **doğrulanamayan** durumda kaldı.
- **Doğrulanmış açık ilan: 0.** Bu sonuç, Türkiye'de hiç açık ilan olmadığı anlamına gelmez.

Şu anda yalnız bu iki okuyucu bağlı. Tüm Türkiye'deki tüm özel/kamu ilanlarına eksiksiz erişim sağlandığı iddia edilmez. İŞKUR, Kariyer Kapısı, Sağlık Bakanlığı ve ÖSYM bağlantıları admin'de ayrı başvuru kaynakları olarak gösteriliyor; çalışan okuyucu sayısına eklenmedi. İŞKUR/özel kariyer siteleri için yetkili API veya izinli besleme entegrasyonu ayrıca gerekir. PDF eklerinin içindeki kadro tabloları ve JavaScript ile yüklenen listeler bu sürümde otomatik çözümlenmiyor. Kaynak başına bir taramada en çok 6 yeni aday ve toplam 8 detay işlenir; bu bir eksiksiz arşiv taraması değildir.

## Gizlilik ve mevcut site

Yeni kayıtlar yalnız `lab_recruitment_sources` ve `lab_recruitment_jobs` tablolarında tutulur. Genel iş ilanı/Radar tablosuna, ana sayfaya, sitemap'e veya üye bildirimlerine eklenmez. `/api/lab-recruitment` gerçek yönetici oturumu gerektirir; üyelik tek başına yeterli değildir. Farklı origin üzerinden değişiklik istekleri reddedilir. Önceki Radar'daki 7 approved ve 1 dismissed kayıt korundu.

## Test ve dağıtım kanıtı

- **358/358 test geçti.** Gerçek oturum, kaynak/robots, tarih ve rol ayrımı, AI nesne/mesaj biçimleri, kanıt kontrolü, sınırlı tekrar ve admin içerik kaçış testleri dahil.
- Yerel tam staging paketinde anonim erişim 401, admin erişim 200, farklı origin 403; iki kaynak ve 81 il filtresi doğrulandı. Gerçekte sunulan admin betiğinde yeni sekme bulundu.
- Canlıda 45 statik dosya hatasız. Yeni API anonim istekte 401; admin betiği 200. Genel ilan yanıtında laboratuvar kaydı bulunmadı.
- Canlı tarayıcıda yönetici hesabıyla görsel kontrol yapılmadı. Yönetici akışı yerel oturum testi ve gerçek sunulan dosya üzerinden doğrulandı; korumalar aşılmadı.
- Staging **V40**: `a6ec8208-c892-4681-871a-d2d1430ee154`; deployment `cc513d11-8bb5-42f8-9e9b-99b62f5cf97d`; SHA256 `9e04195e1deb51fbd249e0e0cb93cd3c51454247171c30f88bd24cd5003a3c10`.
- Canlı **V184**, %100: `1399995e-638d-44c6-82e8-f59f9129c636`; deployment `f85e5c3a-96c9-4f4d-8fad-2e94ed9b8e95`; SHA256 `c14fab3240aad6ea1c4abfb2e4893e3ec716fddf0953a8c0a912fe0c315c93b2`.
- Canlı kaynak tekrar okunup yerel paketle aynı hash doğrulandı. Önceki sürümün bağlantıları ve statik assets ayarları korundu.
- Yalnız iki yeni tablo ve indeks eklendi; mevcut kullanıcı/ilan tabloları değiştirilmedi. Migration öncesi D1 Time Travel bookmark'ları kaydedildi; tam kullanıcı veritabanı indirilmedi veya geri yüklenmedi.

Preview bookmark: `0000002d-00000000-00005117-44ba9a3506331cb2216a92519c3028d1`.
Production bookmark: `000000bc-00000370-00005117-048f40fef75bf2dbc855c4b0f631f199`.
