export const COOKIE = '__Host-yv_admin';
export const SESSION_SECONDS = 30 * 60;
const encoder = new TextEncoder();
const ALLOWED_ORIGINS = new Set(['https://yukvinc.com.tr', 'https://www.yukvinc.com.tr']);
const DEFAULT_SITE = {
  brand_name: 'YükVinç', logo_path: '/assets/mark.svg', primary_color: '#172d35', accent_color: '#f6a13b',
  font_family: 'Inter, Arial, sans-serif', seo_title: 'YükVinç — Vinç kiralama, yol yardım ve operatör ilanları', seo_description: 'Vinç kiralama, oto kurtarıcı, iş makinesi ve operatör ilanlarını şehir, kategori ve fiyata göre ara; onaylı ilanları karşılaştır.', headline: 'Makineyi bul. İşini büyüt.',
  contact_email: '', contact_phone: '', contact_address: '',
  introduction: 'Vinç, çekici, forklift ve operatör ilanlarını tek yerde keşfet. İhtiyacına göre filtrele, fiyatları karşılaştır.',
  hero_image: '/assets/hero.svg', about_title: 'Ekipmana da işe de yer var.', about_text: 'YükVinç, makine ve araç sahiplerinin kiralama ilanlarıyla operatörlerin iş arayışlarını bir araya getiren bir kullanıcı pazaryeridir. İlanlar yayınlanmadan önce yönetici tarafından incelenir.', faq: [{question:'İş arayan operatörler ilan verebilir mi?',answer:'Evet. Üyeler operatör iş arayışı ilanını ücretsiz oluşturabilir; ilan yayınlanmadan önce incelenir.'},{question:'Fiyatları karşılaştırabilir miyim?',answer:'Ekipman ilanlarında en fazla üç ilanı seçip fiyat ve özellikleri yan yana karşılaştırabilirsin. Fiyatlar ilan sahibinden ayrıca teyit edilmelidir.'},{question:'Bu sayfadaki ilanlar gerçek mi?',answer:'Evet. Ana sayfada onaylanmış gerçek kullanıcı ilanları görünür. Fiyat, kapsam ve müsaitliği ilan sahibiyle doğrula.'}], section_order: ['ilanlar','nasil','about','faq','closing'],
  sections: {ilanlar:true,nasil:true,about:true,faq:true,closing:true}
};

export function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
}
export function fail(message, status=400) { return json({error:message}, status); }
export function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  return Boolean(origin && ALLOWED_ORIGINS.has(origin));
}
export async function readJson(request, max=32768) {
  const type = request.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) throw new Error('JSON bekleniyor.');
  const raw = await request.text();
  if (raw.length > max) throw new Error('İstek çok büyük.');
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Geçersiz istek.');
  return data;
}
export function equalSecret(a,b) {const x=encoder.encode(String(a)),y=encoder.encode(String(b));let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0;}
export function randomId(bytes=32) { const a=new Uint8Array(bytes); crypto.getRandomValues(a); return toB64(a); }
function toB64(bytes) { let s=''; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
async function digest(input) { const out=await crypto.subtle.digest('SHA-256', typeof input==='string'?encoder.encode(input):input); return [...new Uint8Array(out)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
export async function hashPassword(password) {
  const salt=new Uint8Array(16); crypto.getRandomValues(salt);
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:210000},key,256);
  return `pbkdf2$210000$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}
function fromB64(s) { const x=s.replace(/-/g,'+').replace(/_/g,'/'); const raw=atob(x+'='.repeat((4-x.length%4)%4)); return Uint8Array.from(raw,c=>c.charCodeAt(0)); }
export async function verifyPassword(password, stored) {
  const parts=String(stored||'').split('$'); if(parts.length!==4||parts[0]!=='pbkdf2'||Number(parts[1])!==210000)return false;
  const salt=fromB64(parts[2]),expected=fromB64(parts[3]);
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:210000},key,256));
  let mismatch=actual.length^expected.length; for(let i=0;i<Math.max(actual.length,expected.length);i++)mismatch|=(actual[i]||0)^(expected[i]||0);
  return mismatch===0;
}
export function cookieValue(request) {
  const cookies=request.headers.get('Cookie')||'';
  const part=cookies.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  return part ? decodeURIComponent(part.slice(COOKIE.length+1)) : '';
}
export function setCookie(token, maxAge=SESSION_SECONDS) { return `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`; }
export function clearCookie() { return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`; }
export async function currentAdmin(request, env) {
  const token=cookieValue(request); if(!token)return null;
  const tokenHash=await digest(token);
  const row=await env.DB.prepare(`SELECT u.id,u.email,u.role FROM admin_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1 AND u.role='admin'`).bind(tokenHash,Math.floor(Date.now()/1000)).first();
  return row||null;
}
export async function requireAdmin(context) {
  if(!isAllowedOrigin(context.request) && !['GET','HEAD'].includes(context.request.method))return {response:fail('İstek kaynağı doğrulanamadı.',403)};
  if(!context.env.DB)return {response:fail('D1 bağlantısı henüz yapılmamış.',503)};
  const admin=await currentAdmin(context.request,context.env); return admin?{admin}:{response:fail('Yönetici oturumu gerekli.',401)};
}
export async function audit(env, actor, action, entityType=null, entityId=null, meta={}) {
  await env.DB.prepare('INSERT INTO admin_activity(actor_user_id,action,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?)').bind(actor,action,entityType,entityId,JSON.stringify(meta)).run();
}
export async function ipHash(request) { return digest(request.headers.get('CF-Connecting-IP')||'unknown'); }
export async function rateLimited(env, request, max=5) {
  const hash=await ipHash(request), now=Math.floor(Date.now()/1000);
  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE created_at < ?').bind(now-86400).run();
  const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_login_attempts WHERE ip_hash=? AND created_at>?').bind(hash,now-900).first();
  return Number(row?.n||0)>=max;
}
export async function noteAttempt(env, request) { await env.DB.prepare('INSERT INTO admin_login_attempts(ip_hash) VALUES(?)').bind(await ipHash(request)).run(); }
export async function getPublicSettings(env) {
  if(!env.DB)return DEFAULT_SITE;
  const row=await env.DB.prepare("SELECT value_json FROM site_settings WHERE setting_key='public_site'").first();
  if(!row)return DEFAULT_SITE;
  try{return {...DEFAULT_SITE,...JSON.parse(row.value_json)}}catch{return DEFAULT_SITE}
}
export function validateSettings(input) {
  const str=(v,max)=>typeof v==='string'&&v.trim().length<=max;
  if(!str(input.brand_name,40)||input.brand_name.trim().length<2)return 'Marka adı 2–40 karakter olmalı.';
  if(!str(input.seo_title,70)||input.seo_title.trim().length<10||!str(input.seo_description,180)||input.seo_description.trim().length<40)return 'SEO başlığı (10–70) veya açıklaması (40–180) geçersiz.';
  for(const k of ['contact_email','contact_phone','contact_address'])if(input[k]!=null&&!str(input[k],300))return 'İletişim alanlarını kontrol et.';
  if(input.contact_email&&input.contact_email.length&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact_email))return 'İletişim e-postası geçersiz.';
  if(input.contact_phone&&input.contact_phone.length&&!/^[+0-9 ()-]{7,20}$/.test(input.contact_phone))return 'İletişim telefonu geçersiz.';
  if(!/^#[0-9a-fA-F]{6}$/.test(input.primary_color)||!/^#[0-9a-fA-F]{6}$/.test(input.accent_color))return 'Renk biçimi geçersiz.';
  const fonts=['Inter, Arial, sans-serif','Arial, Helvetica, sans-serif','Georgia, serif','system-ui, sans-serif'];
  if(!fonts.includes(input.font_family))return 'Yazı tipi listede değil.';
  for(const key of ['logo_path','hero_image']) if(!str(input[key],240)||!input[key].startsWith('/')||input[key].startsWith('//')||input[key].includes('..'))return 'Logo ve görsel, site içi / ile başlayan dosya yolu olmalı.';
  if(!str(input.headline,120)||input.headline.trim().length<3||!str(input.introduction,320)||input.introduction.trim().length<10)return 'Başlık veya açıklama geçersiz.';
  if(!str(input.about_title,100)||!str(input.about_text,1000)||input.about_title.trim().length<3||input.about_text.trim().length<10)return 'Hakkımızda metni geçersiz.';
  if(!Array.isArray(input.faq)||input.faq.length!==3||input.faq.some(x=>!x||!str(x.question,140)||!str(x.answer,700)||x.question.trim().length<5||x.answer.trim().length<10))return 'SSS alanları geçersiz.';
  const allowed=['ilanlar','nasil','about','faq','closing'];
  if(!Array.isArray(input.section_order)||input.section_order.length!==allowed.length||new Set(input.section_order).size!==allowed.length||input.section_order.some(x=>!allowed.includes(x)))return 'Bölüm sırası geçersiz.';
  if(!input.sections||Object.keys(input.sections).length!==allowed.length||allowed.some(k=>typeof input.sections[k]!=='boolean'))return 'Bölüm görünürlüğü geçersiz.';
  return null;
}
export function cleanSiteSettings(input) {
  return {brand_name:input.brand_name.trim(),logo_path:input.logo_path.trim(),primary_color:input.primary_color.toLowerCase(),accent_color:input.accent_color.toLowerCase(),font_family:input.font_family,seo_title:input.seo_title.trim(),seo_description:input.seo_description.trim(),contact_email:String(input.contact_email||'').trim(),contact_phone:String(input.contact_phone||'').trim(),contact_address:String(input.contact_address||'').trim(),headline:input.headline.trim(),introduction:input.introduction.trim(),hero_image:input.hero_image.trim(),about_title:input.about_title.trim(),about_text:input.about_text.trim(),faq:input.faq.map(x=>({question:x.question.trim(),answer:x.answer.trim()})),section_order:input.section_order,sections:Object.fromEntries(['ilanlar','nasil','about','faq','closing'].map(k=>[k,input.sections[k]]))};
}
export {DEFAULT_SITE, digest};
