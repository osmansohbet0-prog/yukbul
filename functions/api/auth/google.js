import {json,fail,isAllowedOrigin,limited,clearAttempts,verifyTurnstile,createSession,setMemberCookie,readMemberJson,randomId} from '../../_lib/member.js';
import {audit} from '../../_lib/core.js';

function decodePart(part){const s=part.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))}
function parsePart(part){return JSON.parse(new TextDecoder().decode(decodePart(part)))}
async function verifyGoogleCredential(token,clientId){
  if(typeof token!=='string'||token.length>8192||!clientId)return null;
  const parts=token.split('.');if(parts.length!==3)return null;
  let header,claims;try{header=parsePart(parts[0]);claims=parsePart(parts[1])}catch{return null}
  if(header.alg!=='RS256'||typeof header.kid!=='string')return null;
  const keysResponse=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(8000),cf:{cacheTtl:300,cacheEverything:true}});
  if(!keysResponse.ok)return null;
  const keys=await keysResponse.json(),jwk=keys.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256');
  if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,decodePart(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  const now=Math.floor(Date.now()/1000);if(!Number.isFinite(claims.exp)||!Number.isFinite(claims.iat))return null;
  if(!valid||!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||claims.aud!==clientId||Number(claims.exp)<=now||Number(claims.iat)>now+60||claims.email_verified!==true||typeof claims.sub!=='string'||typeof claims.email!=='string')return null;
  if(claims.azp&&claims.azp!==clientId)return null;
  return{subject:claims.sub,email:claims.email.trim().toLowerCase()};
}
export async function onRequestPost({request,env}){
  if(!isAllowedOrigin(request))return fail('İstek kaynağı doğrulanamadı.',403);
  if(!env.DB)return fail('D1 henüz bağlanmamış.',503);
  if(!env.GOOGLE_CLIENT_ID)return fail('Google girişi henüz yapılandırılmamış.',503);
  try{
    if(await limited(env,request,'login',8,900))return fail('Çok fazla giriş denemesi. 15 dakika sonra tekrar dene.',429);
    const d=await readMemberJson(request,12000);
    if(!await verifyTurnstile(d.turnstile_token,request,env))return fail('Bot doğrulamasını tamamla.',403);
    const identity=await verifyGoogleCredential(d.credential,env.GOOGLE_CLIENT_ID);
    if(!identity)return fail('Google doğrulaması geçersiz veya süresi dolmuş. Tekrar dene.',401);
    let user=await env.DB.prepare("SELECT id,email,google_sub,role,active FROM users WHERE google_sub=? AND role='member'").bind(identity.subject).first();
    if(!user){
      const existing=await env.DB.prepare("SELECT id,email,google_sub,role,active FROM users WHERE email_norm=?").bind(identity.email).first();
      if(existing&&existing.role!=='member')return fail('Bu Google hesabı üye girişi için kullanılamaz.',403);
      if(existing?.google_sub&&existing.google_sub!==identity.subject)return fail('Bu e-posta başka bir Google hesabına bağlı.',409);
      if(existing){user=existing;if(!existing.google_sub)await env.DB.prepare('UPDATE users SET google_sub=?,updated_at=unixepoch() WHERE id=?').bind(identity.subject,existing.id).run()}
      else{const id=randomId(16);await env.DB.prepare("INSERT INTO users(id,email,email_norm,password_hash,google_sub,role,active) VALUES(?,?,?,NULL,?,'member',1)").bind(id,identity.email,identity.email,identity.subject).run();user={id,email:identity.email,role:'member',active:1}}
    }
    if(Number(user.active)!==1)return fail('Bu hesap devre dışı bırakılmış.',403);
    const token=await createSession(env,user.id);await clearAttempts(env,request,'login');await audit(env,user.id,'member.google.login','session',null,{});
    return json({ok:true,user:{id:user.id,email:user.email}},200,{'set-cookie':setMemberCookie(token)});
  }catch{return fail('Google girişi tamamlanamadı. Migration ve yapılandırmayı kontrol et.',503)}
}
