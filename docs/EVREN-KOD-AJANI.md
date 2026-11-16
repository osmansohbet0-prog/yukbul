# EVREN modelleriyle YükVinç kod ajanı kurulumu

Bu dalda OpenCode için EVREN LLM sağlayıcısı tanımlanmıştır. Bu **kod geliştirme ortamı** yapılandırmasıdır: canlı sitede model çağrısı açmaz, Android uygulamasını tek başına güncellemez ve GitHub Actions ile otomatik kod değiştirme yetkisi vermez.

## 1. EVREN hesabında kullanıcı tarafından yapılacak işlemler
- `https://evren.ssyz.org.tr/api-keys` sayfasına oturum açmış halde git ve yeni LLM API anahtarı oluştur.
- EVREN'in güncel kullanım şartlarını okuyup hesabın üzerinden kabul et. Bu karar kullanıcıya aittir; ajan otomatik onaylayamaz.
- Anahtarı kimseyle paylaşma, sohbet veya GitHub dosyasına yapıştırma. Hesaba tanımlı model erişimi ve kullanım kotasını kontrol et.

## 2. Yerel bilgisayarda OpenCode'a bağlan
- Resmî OpenCode kurulumunu tamamla: `https://opencode.ai/docs/`.
- GitHub deposunu bilgisayarında klonla/aç. `opencode.json` ve `AGENTS.md` bu dalda hazırdır.
- Windows PowerShell'de API anahtarını yalnızca geçerli oturum için **gizli girişle** tanımla:

```powershell
$secret = Read-Host "EVREN API anahtari" -AsSecureString
$env:EVREN_LLM_API_KEY = [System.Net.NetworkCredential]::new("", $secret).Password
Remove-Variable secret
```

- Aynı terminalde depo klasörüne gir ve `opencode` komutunu çalıştır. Ayar dosyası varsayılan `evren/glm-5.3` modelini kullanır.
- `/models` komutuyla diğer EVREN modellerini seçebilirsin. Gerçek erişim listesi hesabının `GET /v1/models` yanıtına bağlıdır; bu yapılandırma tek başına model erişimi vermez.
- 401: anahtar/geçersiz yetki; 403: özellikle kullanım şartları/model erişimi; 429: kota/hız sınırı. Yanlış kimlik doğrulamayı veya limitleri aşmayı otomatik tekrar deneme döngüsüne sokma.

## 3. YükVinç için ilk ajan görevi
Aşağıdaki komutu OpenCode oturumuna gönder:

> Önce AGENTS.md, KURULUM.md ve kod ağacını oku. YükVinç web + Android entegrasyonunu analiz et. Öncelikle profil/fotoğraf/ilan ve yakındaki ilanlar filtrelerinin bozuk akışlarını belirle. Mevcut Cloudflare Worker API ve D1 yapısını bozma. Kodu ayrı feature dalında küçük değişikliklerle düzelt. Test ekle ve npm test ile node --check src/worker.js çalıştır. main'e commit atma, deploy etme; değişikliklerin PR taslağını ve test raporunu hazırla.

## 4. Sınırlamalar
- EVREN, GitHub'daki binlerce modeli otomatik kuran bir model barındırma mekanizması değildir. Burada yalnızca EVREN API hesabının erişebildiği modelleri kullanacak **tek bir kod ajanı** hazırlanmıştır.
- OpenCode'un çok adımlı dosya değiştirme ve araç çağırma yetenekleri seçilen modelin tool-calling desteğine bağlıdır. Önce küçük bir görevle doğrula.
- Anahtar bu depoya eklenmemiştir. Bağlantı, anahtar oluşturulup kullanım şartları kabul edilene kadar doğrulanamaz.
- `main` üzerinde doğrudan düzenleme ve canlı Cloudflare deploy'u otomatik yapılmaz.
