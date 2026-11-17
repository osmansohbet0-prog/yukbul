import {fail,limited,currentMember,randomId} from '../../_lib/member.js';

const STATE = /^[A-Za-z0-9_-]{43,128}$/;
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export async function onRequestGet({request, env}) {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    return fail('İstek kaynağı doğrulanamadı.', 403);
  }
  if (request.headers.get('Origin') && !isAllowedOrigin(request)) {
    return fail('İstek kaynağı doğrulanamadı.', 403);
  }
  if (!env.DB) return fail('D1 henüz bağlanmamış.', 503);
  try {
    if (await limited(env, request, 'login', 8, 900)) {
      return fail('Çok fazla giriş denemesi. 15 dakika sonra tekrar dene.', 429);
    }
    const url = new URL(request.url);
    const state = url.searchParams.get('state') || '';
    const challenge = url.searchParams.get('code_challenge') || '';
    if (url.searchParams.get('app') !== 'android' ||
        !STATE.test(state) || !CHALLENGE.test(challenge) ||
        url.searchParams.get('code_challenge_method') !== 'S256') {
      return fail('Uygulama giriş isteği geçersiz. Tekrar dene.', 400);
    }
    const user = await currentMember(request, env);
    if (!user) return fail('Oturum bulunamadı. Yeniden giriş yap.', 401);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('DELETE FROM mobile_auth_codes WHERE expires_at <= ?').bind(now).run();
    const code = randomId(32);
    await env.DB.prepare(
      'INSERT INTO mobile_auth_codes(code_hash,user_id,code_challenge,expires_at) VALUES(?,?,?,?)',
    ).bind(await digest(code), user.id, challenge, now + 180).run();
    const callback = new URL('yukvinc://auth/callback');
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', state);
    const link = callback.toString().replaceAll('&', '&amp;');
    const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>YükVinç uygulamasına dön</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f0f5f5;color:#172d35;font:16px system-ui,-apple-system,"Segoe UI",sans-serif}
main{width:min(100%,420px);padding:32px;border:1px solid #dce7e6;border-radius:22px;background:white;box-shadow:0 18px 55px #172d3518;text-align:center}
.icon{width:58px;height:58px;margin:0 auto 18px;display:grid;place-items:center;border-radius:18px;background:#0d6d5c;color:white;font-size:27px}
h1{margin:0 0 10px;font-size:25px}p{margin:0 0 24px;color:#53676a;line-height:1.55}
a{display:block;padding:15px 18px;border-radius:12px;background:#0d6d5c;color:white;font-weight:700;text-decoration:none}
small{display:block;margin-top:15px;color:#687a7d}
</style><main><div class="icon" aria-hidden="true">✓</div><h1>Giriş tamamlandı</h1><p>Hesabın doğrulandı. Güvenli şekilde YükVinç uygulamasına dönmek için aşağıdaki düğmeye dokun.</p><a href="${link}">YükVinç uygulamasını aç</a><small>Düğme açılmazsa bu sayfadan geri dönüp uygulamayı seç.</small></main></html>`;
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      },
    });
  } catch {
    return fail('Uygulama girişi hazırlanamadı. Tekrar dene.', 503);
  }
}
async function digest(value) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  let binary = '';
  for (const byte of hash) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
}
