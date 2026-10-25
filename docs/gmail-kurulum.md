# Ayrı Gmail hesabı — ekran ekran kurulum

## Seçilen yöntem ve sınırlar

Cloudflare Workers içinden HTTPS üzerinden **Gmail API + OAuth 2.0 yenileme tokenı** kullanılır. SMTP şifresi veya kişisel yönetici hesabı kullanılmaz. Uygulama, OAuth hesabının adresini Gmail profilinden kontrol eder; belirtilen ayrı hesapla uyuşmazsa göndermez. `gmail.send` ve gelen RET/KALDIR/DÜZELT yanıtlarını almak için `gmail.readonly` gerekir. Gelen kutusu izni yalnızca bu işe ayrılmış hesaba verilmelidir. İzin ekranındaki kapsamları inceleyin.

25 Ekim 2026 kontrolü: [kişisel Gmail](https://support.google.com/mail/answer/22839?hl=en) günde 500'ü aşan mesajda sınır hatası verebilir. [Ücretli Workspace](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace) için yayımlanan genel sınır 2.000 mesaj; deneme hesaplarında 500'dür. Bu değerler daha yüksek gönderim için izin veya teslim garantisi değildir; hesap itibarı ve kötüye kullanım sınırları ayrıca uygulanır. Workspace sınırları kayan 24 saat üzerinden işler. Gmail API aynı hesabın gönderim sınırlarını paylaşır. Bizim başlangıç tavanımız **UTC takvim gününde 20 gönderim denemesi** (panelde 1–100); başarısız veya sonucu belirsiz denemeler de sayılır. Gmail'in kendi kota denetimi ayrıca geçerlidir.

## 1. Ayrı hesap ekranı

Bu iş için yeni bir Gmail hesabı açın, iki adımlı doğrulamayı etkinleştirin. Yönetici girişinde kullandığınız kişisel hesabı bağlamayın. Ayrı hesabın görünen adını YükVinç olarak ayarlayabilirsiniz. Şifreyi veya tokenı sohbete/depo dosyasına yazmayın.

## 2. Google Cloud Console — proje ve Gmail API

1. Google Cloud Console'da ayrı bir proje seçin/oluşturun.
2. **APIs & Services → Library → Gmail API → Enable**.
3. **Google Auth Platform → Branding**: uygulama adını YükVinç yönetim bilgilendirme olarak girin; destek ve geliştirici iletişimi için ayrı hesabınızı kullanın.
4. **Audience**: kişisel Gmail için External; denemede yalnızca ayrı Gmail hesabını Test users listesine ekleyin.
5. **Data Access → Add or remove scopes**: yalnızca `https://www.googleapis.com/auth/gmail.send` ve `https://www.googleapis.com/auth/gmail.readonly`.

Gmail gönderim kapsamı hassas, okuma kapsamı kısıtlıdır. Google'ın doğrulama/kişisel kullanım istisnası ve gerekiyorsa güvenlik değerlendirmesi kuralları geçerlidir. Bu kurulum Google onayını otomatik sağlamaz. External/Testing uygulamasında bu kapsamlardaki refresh token çoğunlukla 7 günde sona erer; sürekli kullanım için uygun yayın durumunu ve Google gerekliliklerini tamamlayın. Token iptal edilirse gönderim kapanır.

## 3. OAuth istemcisi ekranı

1. **Clients → Create client → Web application**.
2. Geçici kurulum için Authorized redirect URIs alanına `https://developers.google.com/oauthplayground` ekleyin.
3. Client ID ve Client secret değerlerini güvenli şekilde alın. Kaynak koduna veya GitHub'a eklemeyin.

## 4. Google OAuth 2.0 Playground ekranı

1. Google'ın OAuth 2.0 Playground sayfasını açın; sağdaki ayar simgesi → **Use your own OAuth credentials**. Kendi istemci bilgilerinizi girin.
2. Access type **Offline**, onay ekranını yeniden gösteren prompt **Consent** olmalı.
3. Yukarıdaki iki Gmail kapsamını seçip **Authorize APIs** deyin; sadece ayrı Gmail hesabıyla izin verin.
4. **Exchange authorization code for tokens**. Refresh tokenı güvenli biçimde alın. Google'a ait araç dışında token paylaşmayın. Playground'un ortak istemcisi yerine kendi istemcinizin seçildiğinden emin olun.
5. Yetki akışı için [Google'ın sunucu tarafı OAuth kılavuzu](https://developers.google.com/workspace/gmail/api/auth/web-server) ve [offline erişim](https://developers.google.com/identity/protocols/oauth2/web-server#offline) geçerlidir.

## 5. Cloudflare — secrets ekranı

**Workers & Pages → yukbul → Settings → Variables and Secrets → Add → Secret**. Aşağıdaki değerleri üretim ortamına tek tek ekleyin; kaydettikten sonra Deploy edin:

- `OUTREACH_GMAIL_ADDRESS`: ayrı `...@gmail.com` hesabının adresi.
- `OUTREACH_GMAIL_CLIENT_ID`: OAuth istemci kimliği.
- `OUTREACH_GMAIL_CLIENT_SECRET`: OAuth istemci secretı.
- `OUTREACH_GMAIL_REFRESH_TOKEN`: offline yetkinin refresh tokenı.

Mevcut secretları silmeyin. Değerler arayüz/API cevabında gösterilmez. Kurulum için kaynak dosyası veya `.env` commit etmeyin.

## 6. YükVinç admin — gönderici ekranı

1. Admin girişinde Access e-posta kodunu, sonra mevcut yönetici girişini tamamlayın.
2. **Firma kayıtları ve ölçüm → Gönderici ve günlük tavan**.
3. Gerçek gönderen ad soyad, yayımlanabilir kurumsal telefon ve ayrı kurumsal e-posta girin. Bilgi uydurulmadığı için başlangıçta boştur; eksikse taslak hazırlanmaz.
4. Günlük tavanı başlangıçta 20 bırakın. **Gmail gönderimini etkinleştir → Kaydet**.
5. **Gmail yanıtlarını kontrol et**. Başarı, OAuth profil ve gelen kutusu erişiminin çalıştığını gösterir. Canlı alıcıya deneme mesajı otomatik gönderilmez.

## 7. Firma kaydı ve ilk mesaj ekranı

1. **İlanlar → İlan oluştur**: il/ilçe önerisini seçin, firma adı/telefon/hizmet girin. Kaynak türünü seçin. Kendi fotoğrafınızı veya kullanım izniniz olan görseli yükleyebilirsiniz; başka sitelerden fotoğraf/logo kopyalamayın. İlçe koordinatı yaklaşık merkezdir; kesin konumu kontrol etmeden doğrulama kutusunu işaretlemeyin.
2. **Firma kayıtları ve ölçüm** listesinden **İletişim kaydını düzenle** ile varsa firmaya ait gerçek e-postayı ekleyin.
3. **İlan sahibini bilgilendir**: bağlantısız taslağı inceleyin. Ücret/onay, gönderen, 3 iş günü ve ret cümlelerini koruyun.
4. İYS kontrolünü yaptıktan sonra onay kutusunu işaretleyin. **Onayla ve e-posta gönder** her mesaj için ayrı insan kararıdır.
5. E-posta yoksa **Onayla ve kopyala**. SMS/WhatsApp gönderimi telefonunuzdan yapılır; sistem görüşme veya teslim verisi uydurmaz. Elle gönderince iletişim durumunu güncelleyin.

## 8. Ret / kaldırma ekranı

- Bağlı Gmail gelen kutusu yaklaşık 5 dakikada bir taranır; taslak ve gönderim öncesinde tekrar kontrol edilir. Tarama başarısızsa yeni taslak/gönderim engellenir.
- Yanıtın ilk düz metin satırı tam olarak RET, KALDIR veya DÜZELT ise bilinen alıcıyla eşleştirilir. Alıntılanmış eski mesajdaki kelimeler ret sayılmaz. Serbest dilli/yalnız HTML yanıtlar ve 30 günden eski mesajlar otomatik çözümlenmez; gelen kutusunu ayrıca kontrol edin.
- Gmail taraması yalnızca yeni talep kaydı/ret engeli oluşturur; yayından kaldırma yöneticinin **Yayından kaldır** düğmesiyle olur.
- Telefonunuzdan gelen RET/KALDIR yanıtlarını aynı düğmelerle hemen kaydedin. Ret listesindekine yeni taslak/gönderim engellenir. Kaldırma kaydı silinmez; Kaldırıldı görünür ve aynı telefon/e-posta/firma-konum anahtarıyla tekrar kayıt engellenir.
- Süre hatırlatması hafta sonu hariç üç gündür; resmî tatil hesabı yapılmadığından bazı hatırlatmalar daha erken gelebilir.

## 9. Ölçüm ekranı

Tarih aralığı seçip İstatistikleri göster'e basın. Görüntüleme/telefon/WhatsApp **tıklamaları** sayılır. Bilinen botlar elenir; aynı günlük ağ/tarayıcı özeti ve ilanda 30 dakikalık tekrarlar tek sayılır. Aynı ağdaki kişiler birleşebilir, IP/tarayıcı değişikliği yeni sayılabilir. Bunlar benzersiz kişi, telefon görüşmesi veya satış sayısı değildir. Geçmiş ziyaretler üretilmez. `METRICS_HASH_KEY` secretı yoksa ölçüm kapalı gösterilir.

## Arıza ve alternatif

Google OAuth onayı, kapsam veya hesap sınırı nedeniyle Gmail çalışmazsa gönderim kapalı kalır. Aynı taslak başka yoldan otomatik gönderilmez. Kopyalama ve insanın telefonundan bilgilendirmesi kullanılabilir; kurumsal e-posta için mevcut Cloudflare Email Service gibi doğrulanmış alan adı tabanlı bir sağlayıcı ayrıca bağlanabilir. Bu alternatif bu akışa sessizce etkinleştirilmedi.

Gönderim zaman aşımında durum **belirsiz** olur; Gmail Gönderilenler kutusunu kontrol edin. Otomatik tekrar yoktur. İçerik ve alıcı bilgileri yalnızca yönetim kayıtlarında tutulur. 180 günlük taslak/ileti geçmişi ve 400 günlük toplu tıklama verisi saklama süreleri uygulanır; ret anahtarları tekrar iletişimi önlemek için tutulur. Bu teknik kurulum hukuki uygunluk veya sertifika iddiası değildir.
