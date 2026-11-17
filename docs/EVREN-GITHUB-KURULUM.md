# GitHub Actions üzerinden EVREN bağlantısı — düşük kredi tüketimi

Bu entegrasyon **manuel olarak çalıştırılır**; `push`, `pull_request` veya zamanlayıcıyla otomatik API çağrısı yapmaz.

## Güvenlik: sohbet mesajında paylaşılan anahtar
Kullanıcının bir sohbet mesajında paylaştığı eski API anahtarı **iptal edilmeli** ve EVREN panelinden yeni bir anahtar oluşturulmalıdır. Eski anahtarı GitHub'a eklemeyin. Anahtarın değerini burada veya başka bir metin dosyasında tekrar yazmayın.

## Kullanıcı tarafından tamamlanacak tek gizli ayar
1. EVREN → API Anahtarları → eski anahtarı iptal et, yenisini oluştur: https://evren.ssyz.org.tr/api-keys
2. GitHub → depo → Settings → Secrets and variables → Actions → New repository secret:
   https://github.com/osmansohbet0-prog/yukbul/settings/secrets/actions
3. Secret name: `EVREN_LLM_API_KEY`. Secret value: **yalnızca yeni üretilen gizli anahtar**.
4. "Add secret" butonuyla kaydet. Değer dosyalara, commit'lere, yorumlara veya sohbete eklenmemelidir.

GitHub bağlantısının API secret'ını oluşturmak/değiştirmek için yetkili bir aracı bulunmadığından bu kişisel işlem kullanıcı tarafından tamamlanmalıdır.

## Çalıştırma
- İş akışı `.github/workflows/evren-on-demand.yml` dosyasındadır.
- GitHub Actions `workflow_dispatch` iş akışını listelemesi için workflow'un varsayılan dalda yer alması gerekebilir. Mevcut PR **taslak olarak kalır**: canlı site otomatik yayımlanmasın diye hiçbir şekilde main'e doğrudan merge yapılmaz.
- Güvenli yayın/CI onayından sonra GitHub → Actions → **EVREN - kontrollu tek istek** → **Run workflow**.
- `operation=verify` en güvenli ilk seçenek: `GET /v1/models` ile yalnızca erişim doğrular; sohbet tamamlaması yapmaz. Erişilebilir modellerin sayısını bildirir.
- `operation=review` sadece onaylı tek bir kısa model çağrısı yapar, `max_tokens=128`, yeniden deneme YOK, otomatik kod değiştirme YOK. Kredi %1 olduğundan şimdilik **review çalıştırılması önerilmez**.
- `model` EVREN hesabının gerçek model kimliğiyle eşleşmelidir; erişim listesi doğrulanmadan modellerin kullanılabilir olduğu iddia edilmez.

## Sınırlar
- EVREN API anahtarı hiçbir zaman repoda veya GitHub Actions loglarında yazdırılmaz.
- Bu iş akışı kod ajanı değil, EVREN ile bağlantıyı doğrulayan ve tek kısa inceleme alabilen kontrollü bir entegrasyondur. Gerçek çok adımlı geliştirme için OpenCode ve `AGENTS.md` ayrı olarak hazırlanmıştır.
- Canlı Worker koduna, D1 veritabanına ve Android APK'ya dokunmaz.
- Android kaynak kodu `feature/yukvinc-mobile-mvp` dalındadır, `main` dalında değildir. İki dal karşılaştırılıp uyumlandırılmadan Android kaynakları üzerinde otomatik değişiklik yapılmamalıdır.
