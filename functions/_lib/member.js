import {json,fail,randomId,digest,hashPassword,verifyPassword,isAllowedOrigin,readJson,ipHash} from './core.js';

export const MEMBER_COOKIE='__Host-yv_member';
export const MEMBER_SECONDS=60*60*24*14;
export const setMemberCookie=token=>`${MEMBER_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${MEMBER_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
export const clearMemberCookie=()=>`${MEMBER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
export function cookieToken(request){const raw=request.headers.get('Cookie')||'';const x=raw.split(';').map(s=>s.trim()).find(s=>s.startsWith(MEMBER_COOKIE+'='));try{return x?decodeURIComponent(x.slice(MEMBER_COOKIE.length+1)):'';}catch{return ''}}
export async function currentMember(request,env){const token=cookieToken(request);if(!token||!env.DB)return null;return await env.DB.prepare("SELECT u.id,u.email,u.role FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND u.role='member'").bind(await digest(token),Math.floor(Date.now()/1000)).first();}
export async function requireMember(context){if(!isAllowedOrigin(context.request)&&!['GET','HEAD'].includes(context.request.method))return{response:fail('İstek kaynağı doğrulanamadı.',403)};if(!context.env.DB)return{response:fail('D1 bağlantısı henüz yapılmamış.',503)};const member=await currentMember(context.request,context.env);return member?{member}:{response:fail('İlan vermek için önce hesabına giriş yap.',401)};}
export async function verifyTurnstile(token,request,env){if(!env.TURNSTILE_SECRET||!env.TURNSTILE_SITE_KEY)return false;if(typeof token!=='string'||token.length<10||token.length>2048)return false;try{const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/x-www-form-urlencoded'},body:(()=>{const v=new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token}),ip=request.headers.get('CF-Connecting-IP');if(ip)v.set('remoteip',ip);return v})()});if(!res.ok)return false;const data=await res.json();return data.success===true&&data.action==='member_auth'&&(['yukvinc.com.tr','www.yukvinc.com.tr'].includes(data.hostname));}catch{return false}}
export async function limited(env,request,action,max=8,windowSecs=3600){const h=await ipHash(request),now=Math.floor(Date.now()/1000);await env.DB.prepare('DELETE FROM user_login_attempts WHERE created_at<?').bind(now-86400).run();const r=await env.DB.prepare('SELECT COUNT(*) n FROM user_login_attempts WHERE ip_hash=? AND action=? AND created_at>?').bind(h,action,now-windowSecs).first();if(Number(r?.n||0)>=max)return true;await env.DB.prepare('INSERT INTO user_login_attempts(ip_hash,action) VALUES(?,?)').bind(h,action).run();return false;}
export async function clearAttempts(env,request,action){await env.DB.prepare('DELETE FROM user_login_attempts WHERE ip_hash=? AND action=?').bind(await ipHash(request),action).run();}
export async function createSession(env,userId){const token=randomId(32),hash=await digest(token),now=Math.floor(Date.now()/1000);await env.DB.prepare('DELETE FROM user_sessions WHERE expires_at<=?').bind(now).run();await env.DB.prepare('INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(hash,userId,now+MEMBER_SECONDS).run();return token;}
export async function readMemberJson(request,max=20000){
 const type=(request.headers.get('content-type')||'').toLowerCase();
 try{
  if(type.includes('application/json'))return await readJson(request,max);
  if(type.includes('application/x-www-form-urlencoded')){
   const raw=await request.text();
   if(raw.length>max)throw new Error('İstek çok büyük.');
   const params=new URLSearchParams(raw),data={};
   for(const [key,value] of params){if(Object.prototype.hasOwnProperty.call(data,key))throw new Error('Tekrarlanan alan.');data[key]=value}
   return data;
  }
  throw new Error('Desteklenmeyen form türü.');
 }catch(e){if(String(e?.message||'').includes('İstek çok büyük'))throw new Error('İstek çok büyük.');throw new Error('Form verileri okunamadı.')}
}
export async function createMember(env,email,password){const id=randomId(16),encoded=await hashPassword(password);await env.DB.prepare("INSERT INTO users(id,email,email_norm,password_hash,role,active) VALUES(?,?,?,?,'member',1)").bind(id,email,email,encoded).run();return{id,email,role:'member'};}
export async function loginMember(env,email,password){const user=await env.DB.prepare("SELECT id,email,password_hash,role,active FROM users WHERE email_norm=? AND role='member'").bind(email).first();const dummy='pbkdf2$100000$MDEyMzQ1Njc4OWFiY2RlZg$4iB6f3p-jfQ5csC8mIi0oGZleGrJ2z1Tl3taRaVsmxM';const ok=await verifyPassword(password,user?.password_hash||dummy);return user&&Number(user.active)===1&&ok?{id:user.id,email:user.email,role:user.role}:null;}
export {json,fail,randomId,digest,hashPassword,verifyPassword,isAllowedOrigin,ipHash};
