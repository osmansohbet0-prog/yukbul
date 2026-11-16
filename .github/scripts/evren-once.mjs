// GitHub Actions-only EVREN integration: NEVER print or commit credentials.
// Runs manually. "verify" makes one model-list request and no generation calls.
// "review" makes exactly one small chat-completion request (max_tokens: 128), with no retries.
import { readFileSync, appendFileSync } from 'node:fs';

const key = process.env.EVREN_LLM_API_KEY;
const operation = process.env.EVREN_OPERATION ?? 'verify';
const model = process.env.EVREN_MODEL ?? 'glm-5.3';
const endpoint = 'https://evren-llmapi.ssyz.org.tr/v1';
const summary = process.env.GITHUB_STEP_SUMMARY;

function report(text) {
  if (summary) appendFileSync(summary, text + '\n', 'utf8');
  else console.log(text);
}
function fail(text) {
  console.error(text);
  process.exitCode = 1;
}
if (!key) {
  fail('EVREN_LLM_API_KEY Actions secret bulunamadi. Anahtari sohbette veya dosyada paylasmayin.');
} else if (!['verify', 'review'].includes(operation)) {
  fail('Bilinmeyen islem.');
} else {
  const headers = {
    'Authorization': `Bearer ${key}`,
    'X-API-Key': key,
    'Accept': 'application/json',
  };
  try {
    if (operation === 'verify') {
      const response = await fetch(`${endpoint}/models`, {
        headers,
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`EVREN API HTTP ${response.status}`);
      const json = await response.json();
      const count = Array.isArray(json?.data) ? json.data.length : 'bilinmiyor';
      report(`## EVREN baglanti testi\nModel listeleme istegi basarili. Erisilebilir model sayisi: **${count}**.\n\nUretim istegi yapilmadi, token uretilmedi.`);
    } else {
      // The review is intentionally small to protect remaining EVREN credits.
      const scope = [
        ['functions/api/ai/nearby.js', 1800],
        ['functions/api/listings/index.js', 1700],
      ];
      const context = scope.map(([path, limit]) => {
        const content = readFileSync(path, 'utf8').slice(0, limit);
        return `DOSYA: ${path}\n${content}`;
      }).join('\n\n');
      const payload = {
        model,
        max_tokens: 128,
        messages: [
          {
            role: 'system',
            content: 'Sen YükVinç için kıdemli kod denetçisisin. Yalnızca sağlanan kodu incele. Bir tane somut, düşük riskli iyileştirme öner. Kanıt yoksa tahminde bulunma. Çıktıyı 100 Türkçe kelimeyle sınırla. Kod veya veritabanını kendin değiştirme.',
          },
          {
            role: 'user',
            content: `Mobil API yakın ilan akışında güvenli küçük iyileştirme önerisi üret. Canlı siteye dokunma.\n${context}`,
          },
        ],
      };
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error(`EVREN API HTTP ${response.status}`);
      const json = await response.json();
      const answer = json?.choices?.[0]?.message?.content;
      if (typeof answer !== 'string' || !answer.trim()) {
        throw new Error('EVREN cevabi bos ya da beklenmeyen bicimde.');
      }
      report(`## EVREN tek istekli kod onerisi\n\n${answer.slice(0, 2000)}\n\nNot: Kod otomatik degistirilmedi. Uretim cevabi en fazla 128 token ile sinirlandirildi; tekrar deneme yok.`);
    }
  } catch (error) {
    fail(`EVREN islemi tamamlanamadi: ${error instanceof Error ? error.message : 'bilinmeyen hata'}`);
  }
}
