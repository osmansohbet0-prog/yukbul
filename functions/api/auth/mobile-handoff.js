import {json,fail,isAllowedOrigin,limited,currentMember,readMemberJson,randomId} from '../../_lib/member.js';

const STATE = /^[A-Za-z0-9_-]{43,128}$/;
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export async function onRequestPost({request, env}) {
  if (!isAllowedOrigin(request)) return fail('İstek kaynağı doğrulanamadı.', 403);
  if (!env.DB) return fail('D1 henüz bağlanmamış.', 503);
  try {
    if (await limited(env, request, 'login', 8, 900)) {
      return fail('Çok fazla giriş denemesi. 15 dakika sonra tekrar dene.', 429);
    }
    const data = await readMemberJson(request, 4096);
    if (!STATE.test(data.state || '') || !CHALLENGE.test(data.code_challenge || '') ||
        data.code_challenge_method !== 'S256') {
      return fail('Uygulama giriş isteği geçersiz. Tekrar dene.', 400);
    }
    const user = await currentMember(request, env);
    if (!user) return fail('Oturum bulunamadı. Yeniden giriş yap.', 401);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('DELETE FROM mobile_auth_codes WHERE expires_at <= ?').bind(now).run();
    const code = randomId(32);
    await env.DB.prepare(
      'INSERT INTO mobile_auth_codes(code_hash,user_id,code_challenge,expires_at) VALUES(?,?,?,?)',
    ).bind(await digest(code), user.id, data.code_challenge, now + 180).run();
    return json({ok: true, code}, 201);
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
