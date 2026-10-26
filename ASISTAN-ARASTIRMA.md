# YükUsta araştırma ve yeniden kurulum notu

Tarih: 27 Ekim 2026

## İncelenen durum ve yeniden üretilen hata

Üretimde çalışan `yukbul` Worker kaynak kodunu Cloudflare üzerinden inceledim; ziyaretçi konuşma kayıtlarına bakmadım. Dağıtılmış eski arama mantığı, şehirleri ekleri ayrılmış ya da yalnızca sınırlı eklerle yazıldığında tanıyor; ilçe listesi ise elle tutulmuş kısmi bir sözlük. Şehir bulunamazsa önceki konuşmadaki ilçeyi/şehri tekrar kullanabiliyor.

Hata yerelde tekrar üretildi: önce `Gebze’de vinç var mı?`, ardından bitişik yazımla `konyadaki vinc var mi` sorulduğunda arama niyeti `city: Kocaeli, district: gebze` oluyor. Oysa `Konya'daki` biçiminde apostrof olduğunda `Konya` bulunuyor. Bu yüzden önceki Kocaeli/Gebze bağlamı yeni Konya isteğine sızabiliyor. Ayrı bir kusur da şehir filtresinin SQL tarafında şehir ve ilçe sütunlarına `%...%` ile bakması; bu gereksiz adayları içeri alıyor. Sonraki eşleşme filtresi çoğunu eliyor, dolayısıyla SQL LIKE tek başına örnekteki Kocaeli sonucunu kanıtlamıyor.

Kök neden bu nedenle: bitişik Türkçe yer eki çözümlemesinin eksikliği ve yeni, çözümlenemeyen konumda eski konumu güvenle bırakmak yerine taşımak. Önceki testler parser'daki konuşma bağlamı ve tam akış davranışını ölçmedi. Eski model normal arama adaylarını seçmiyordu; hata modelin ilan uydurmasından çok deterministik konum ayrıştırma/bağlam yönetimi kaynaklı. Bu açıklama kodla yeniden üretilen örnek için kanıtlı; geçmişteki belirli kullanıcı oturumunun tam yazımını ziyaretçi kayıtlarından doğrulamadım.

## Ürün ve doğruluk kararları

- Şehir ve ilçe adları sitedeki tam Türkiye konum listesinden çözülür; elle yazılmış ilçe eşlemesi kullanılmaz.
- Yazım, Türkçe karakter, kesme işareti ve bitişik/ayrık yaygın hâl ekleri normalize edilir. Tek güvenli yazım düzeltmesi kabul edilir; çakışan/çok anlamlı konumda soru sorulur.
- Açıkça yeni bir konum varsa önceki konum devralınmaz. İlçe tek başına yalnızca tek ile aitse o ile bağlanır; birden fazla ildeki “Merkez” gibi adlar şehir sorusu açar.
- Arama için yalnızca `approved` ilanlar ve mevcut yayında kalma, süre, gizleme ve görünürlük kuralları kullanılır. Şehir ve ilçe karşılaştırması tam eşitliktir. “Önerilen alternatif” ayrı etiketlenir; yanlış şehir/kategori eşleşmesi ana sonuç diye sunulmaz.
- Yapay zekâ arama kararını, konumu, fiyatı ya da ilanı belirlemez. Sonuçlar veri tabanı filtresi ve sabit kısa metinlerle oluşturulur. Yapay zekâ varsa yalnızca ilan seçmeyen genel sohbet/kısa anlatımda, sınırlı bütçe ve çıktı doğrulamasıyla çalışır; arama kartlarının telefon/özel bilgileri modele gönderilmez.
- Maksimum 3 kısa sonuç kartı; şehir/ilçe, ücret birimi, varsa “Premium”, ilana git ve yalnızca halka açık numara mevcutsa ara düğmesi. “Şikâyet”, “fiyat/pazarlık”, kaldırma/düzeltme talepleri asistanda bilet açmaz; İletişim sayfasına yönlenir. Kaldırma/düzeltme talebi kişi tarafından, ilan başlığı/numarasıyla gönderilebilir.
- Konum ve ilan sonuçları en fazla 60 saniye eski olabilir; yeni arama her zaman güncel, tam filtreli sorgu yapar. Telefon, e-posta, adres ve serbest metin yapay zekâ çağrılarına dahil edilmez.

## 2026-10-27 resmi kaynak araştırması

- Cloudflare Workers AI modelleri ve model kataloğu: https://developers.cloudflare.com/workers-ai/models/ — mevcut `@cf/meta/llama-3.1-8b-instruct-fast` etkin varyant, Cloudflare changelog tarafından da korunuyor: https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/. YükUsta bu modeli yalnızca sabit, kişisel verisiz selamlama konusu için kullanır; arama ve ilan seçimi modele gitmez.
- Workers AI fiyatlandırması: https://developers.cloudflare.com/workers-ai/platform/pricing/ — belgede ücretsiz hesaplar için günlük 10.000 Neurons tahsisi ve bunun üzerindeki güncel fiyat bilgisi bulunuyor; kullanım öncesi hesabın gerçek tahsisi ve model uygunluğu panelden doğrulanmalı.
- Workers AI sınırları: https://developers.cloudflare.com/workers-ai/platform/limits/ — genel metin üretimi varsayılanı 300 istek/dakika; ücretli modeller daha düşük olabilir. Bu genel servis sınırları uygulamanın günlük bütçesini kaldırmaz.
- Cloudflare Workers sınırları: https://developers.cloudflare.com/workers/platform/limits/ — ücretsiz plandaki istek/CPU sınırları ürün kotası ve D1 maliyetinden ayrıdır.
- Arama tasarımı: https://www.nngroup.com/articles/less-chat-more-answer/ ve https://www.nngroup.com/articles/ai-chatbots-design-guidelines/ — arama yapan kişi çoğu kez kısa, eksik sorgularla doğrudan taranabilir sonuç ister; kapsam ve hızlı eylemler görünür olmalı.
- Mobil filtreler: https://baymard.com/mcommerce-usability/benchmark/mobile-page-types/filtering-options — mobilde uzun, bölünmüş filtre akışları kullanımı zorlaştırabilir; sohbeti kısa tutma ve ana filtre sorusunu tek seferde sorma kararını destekliyor.

## Doğrulama hedefleri

En az 150 farklı Türkçe sorgu/bağlam örneği; şehir, ilçe, kategori ve ek ayrıştırma için yüzde 100 tam eşleşme; bilinmeyen/çakışan konumda yanlış ilanın asla sonuç olmaması; onaylanmamış/süresi dolmuş ilanların dışlanması; model yanıtının kart/konum seçememesi; mobil kart ve iletişim yönlendirmelerinin test edilmesi.

