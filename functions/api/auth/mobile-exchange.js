import {json,fail,isAllowedOrigin,limited,clearAttempts,readMemberJson,randomId,createSession,setMemberCookie} from '../../_lib/member.js';
import {audit} from '../../_lib/core.js';

const TOKEN = /^[A-Za-z0-9_-]{43,128}$/;

export async function onRequestPost({request, env}) {
  if (!isAllowedOrigin(request)) return fail('İstek kaynağı doğrulanamadı.', 403);
  if (!env.DB) return fail('D1 henüz bağlanmamış.', 503);
  try {
    if (await limited(env, request, 'login', 8, 900)) {
      return fail('Çok fazla giriş denemesi. 15 dakika sonra tekrar dene.', 429);
    }
    const data = await readMemberJson(request, 4096);
    if (!TOKEN.test(data.code || '') || !TOKEN.test(data.code_verifier || '')) {
      return fail('Uygulama giriş kodu geçersiz veya süresi dolmuş. Yeniden giriş yap.', 401);
    }
    const challenge = await codeChallenge(data.code_verifier);
    const now = Math.floor(Date.now() / 1000);
    const issued = await env.DB.prepare(
      'DELETE FROM mobile_auth_codes WHERE code_hash = ? AND code_challenge = ? AND expires_at > ? RETURNING user_id',
    ).bind(await digest(data.code), challenge, now).first();
    if (!issued?.user_id) return fail('Uygulama giriş kodu geçersiz, kullanılmış veya süresi dolmuş.', 401);
    const user = await env.DB.prepare(
      "SELECT id,email FROM users WHERE id = ? AND role = 'member' AND active = 1",
    ).bind(issued.user_id).first();
    if (!user) return fail('Bu hesap kullanılamıyor.', 403);
    const token = await createSession(env, user.id);
    await clearAttempts(env, request, 'login');
    await audit(env, user.id, 'member.mobile.google.login', 'session', null, {});
    return json({ok: true, user: {id: user.id, email: user.email}}, 200, {
      'set-cookie': setMemberCookie(token),
    });
  } catch {
    return fail('Uygulama oturumu açılamadı. Tekrar dene.', 503);
  }
}

async function digest(value) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  let binary = '';
  for (const byte of hash) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
}
async function codeChallenge(verifier) {
  return digest(verifier);
}
