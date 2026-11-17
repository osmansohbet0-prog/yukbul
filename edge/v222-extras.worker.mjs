import {runAutoReview,validPhone} from './v222-auto-review.mjs';
/* YükVinç V222 additive Worker. Primary 'yukbul' script and admin/radar routing stay untouched.
   Package step replaces the two placeholder JS string literals with repo edge assets. */
const CLIENT_JS = '__INJECT_CLIENT_JS__';
const CLIENT_CSS = '__INJECT_CLIENT_CSS__';
const FORM_SCRIPT = '__INJECT_FORM_SCRIPT__';
const FORM_ROUTE = '/assets/yv-v222-listing-form.js';
const CORS_ORIGIN = 'https://yukvinc.com.tr';
const VERSION = 'v222-extras-20261118.19';
const CLIENT_ROUTE = '/assets/yv-v222-extras.js';
const CSS_ROUTE = '/assets/yv-v222-extras.css';
const API_PREFIX = '/api/yukusta-v2/';
function respond(data,status=200,headers={}) {
  return Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
}
function error(message,status=400){return respond({ok:false,message},status)}
function safeMessage(s,max=600){return String(s||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').trim().slice(0,max)}
function redact(s) {
  return String(s||'')
    .replace(/\bTR\s*(?:\d\s*){24}\b/gi,'[IBAN gizlendi]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[e-posta gizlendi]')
    .replace(/(?:\+?90[\s-]?)?(?:0?[2-5]\d{2})[\s().-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g,'[telefon gizlendi]')
    .replace(/(?:https?:\/\/|www\.)[^\s<]+/gi,'[bağlantı gizlendi]');
}
function originOkay(request){
  const header=request.headers.get('Origin');
  const host=new URL(request.url).hostname;
  if(!['yukvinc.com.tr','www.yukvinc.com.tr'].includes(host))return true;
  return !header || header === CORS_ORIGIN || header==='https://www.yukvinc.com.tr';
}
async function parseBody(request,max=6000){
  if(Number(request.headers.get('content-length')||0)>max)throw Error('Mesaj çok uzun.');
  const text=await request.text();
  if(text.length>max)throw Error('Mesaj çok uzun.');
  return JSON.parse(text);
}
async function actorKey(request){
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const day=new Date().toISOString().slice(0,10);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+':'+day+':yv2'));
  return 'visitor_'+[...new Uint8Array(bytes)].slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function rate(env,request,action,max,windowSeconds){
  const actor=await actorKey(request);
  try{
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM ai_audit WHERE actor=? AND action=? AND created_at>unixepoch()-?').bind(actor,action,windowSeconds).first();
    if(Number(count?.n||0)>=max)return {blocked:true,actor};
    await env.DB.prepare('INSERT INTO ai_audit(id,actor,action,outcome,metadata_json) VALUES(?,?,?,?,?)')
      .bind(crypto.randomUUID().replaceAll('-',''),actor,action,'received','{}').run();
    return {blocked:false,actor};
  }catch{return {blocked:true,actor}}
}
async function publicTenders(env){
  // Only public, approved and non-expired records. Sorted by YükVinç's actual publication time.
  const now=Math.floor(Date.now()/1000);
  const result=await env.DB.prepare(
    "SELECT id, title, source_url, public_at FROM lead_radar_leads "+
    "WHERE status='approved' AND public_at IS NOT NULL AND public_at<=? "+
    "AND (public_expires_at IS NULL OR public_expires_at>?) "+
    "ORDER BY public_at DESC, id ASC LIMIT 200"
  ).bind(now,now).all();
  const items=(result.results||[]).map(row=>({
    id:String(row.id||''),title:String(row.title||'').slice(0,240),
    source_url:String(row.source_url||'').slice(0,700),
    published_at:Number(row.public_at||0),
    is_new:Number(row.public_at||0)>=now-172800
  })).sort((a,b)=>b.published_at-a.published_at||a.id.localeCompare(b.id));
  return {ok:true,new_count:items.filter(x=>x.is_new).length,items};
}
async function report(request,env){
  if(request.method!=='POST')return error('Yöntem desteklenmiyor.',405);
  if(!originOkay(request))return error('İstek kaynağı doğrulanamadı.',403);
  let data;try{data=await parseBody(request,3200)}catch{return error('Şikâyet mesajı geçersiz.',400)}
  const msg=safeMessage(data?.message,2100);
  if(msg.length<12||msg.length>2000)return error('Şikâyet 12–2000 karakter olmalı.');
  const lim=await rate(env,request,'assistant.v2.support',3,3600);
  if(lim.blocked)return error('Kısa sürede fazla talep gönderildi. Daha sonra tekrar dene.',429);
  const id=crypto.randomUUID().replaceAll('-','');
  try{
    await env.DB.prepare('INSERT INTO support_tickets(id,source,summary_redacted,contact_name,contact_details,consent_email,email_status) VALUES(?,?,?,?,?,?,?)')
      .bind(id,'assistant',redact(msg).slice(0,2000),null,null,0,'not_requested').run();
    return respond({ok:true,reference:id,message:'Şikâyet kaydedildi; yönetici panelinde incelemeyi bekliyor.'},201);
  }catch(e){console.error('yv2 report insert',e?.name||'Error');return error('Şikâyet kaydedilemedi. İletişim sayfasını kullan.',503)}
}
function looksLikeSearch(msg){
  const text=msg.toLocaleLowerCase('tr');
  return /(vinç|vinc|manlift|çekici|forklift|platform|kiralık|kiralik|kiralama|iş makinesi|mobil lastik|yol yardım|ilan bul|sepetli|asansör)/i.test(text);
}
async function oldAssistant(request,env,message,history){
  if(!env.ORIGIN)return null;
  const r=new Request('https://yukvinc.com.tr/api/ai/assistant',{method:'POST',headers:{'content-type':'application/json','origin':CORS_ORIGIN},body:JSON.stringify({message,history})});
  try{
    const response=await env.ORIGIN.fetch(r);
    if(!response.ok)return null;
    const data=await response.json();
    return {ok:true,answer:safeMessage(data.answer,1300),listings:Array.isArray(data.listings)?data.listings.slice(0,3):[],mode:'search',complaint_suggestion:false};
  }catch{return null}
}
async function chat(request,env){
  if(request.method!=='POST')return error('Yöntem desteklenmiyor.',405);
  if(!originOkay(request))return error('İstek kaynağı doğrulanamadı.',403);
  let body;try{body=await parseBody(request,7000)}catch{return error('Sohbet mesajı geçersiz.',400)}
  const message=safeMessage(body?.message,600);
  if(message.length<2)return error('Biraz daha ayrıntılı yazabilir misin?');
  const history=(Array.isArray(body.history)?body.history:[]).slice(-6)
    .filter(x=>x && (x.role==='user'||x.role==='assistant') && typeof x.content==='string')
    .map(x=>({role:x.role,content:redact(safeMessage(x.content,400))}));
  const limit=await rate(env,request,'assistant.v2.chat',20,1800);
  if(limit.blocked)return error('Sohbet sınırına ulaştın. Bir süre sonra tekrar deneyebilirsin.',429);
  if(/(?:şikayet|şikâyet|dolandırıcı|sahte ilan|şikayetçiyim)/i.test(message)){
    return respond({ok:true,answer:'Bunu incelemeye iletebiliriz. Şikâyet formuna ilgili ilanı ve yaşadığın sorunu yaz. Gönderdiğinde yönetici paneline kaydedilecek.',listings:[],complaint_suggestion:true,mode:'complaint'});
  }
  if(/(?:acil|yaralı|kaza|yangın|ambulans)/i.test(message)&&/(?:yaralı|yangın|ambulans|kaza)/i.test(message)){
    return respond({ok:true,answer:'Güvenli bir yere geç ve acil tehlike varsa 112’yi ara. Bu sohbet acil müdahale hizmeti değil.',listings:[],mode:'safety'});
  }
  if(looksLikeSearch(message)){
    const old=await oldAssistant(request,env,message,history);
    if(old&&old.answer)return respond(old);
  }
  if(!env.AI)return respond({ok:true,answer:'Buradayım! 🙂 İstersen vinç, iş ilanı, ihale veya site kullanımı hakkında konuşabiliriz. Şikâyetleri de buradan iletebilirsin.',listings:[],mode:'fallback'});
  try{
    const today=await env.DB.prepare("SELECT COUNT(*) AS n FROM ai_audit WHERE action='assistant.v2.chat' AND created_at>=unixepoch('now','start of day')").first();
    if(Number(today?.n||0)>500)return error('Bugünkü sohbet kotası doldu. İlan aramayı kullanabilirsin.',429);
    const aiEnabled=await env.DB.prepare("SELECT value_json FROM site_settings WHERE setting_key='ai_moderation'").first();
    if(aiEnabled?.value_json&&JSON.parse(aiEnabled.value_json).enabled===false)return error('Yük Usta geçici olarak kapalı.',503);
    const prompt='Sen YükVinç pazaryerinin samimi, kısa ve güvenilir Türkçe sohbet asistanı Yük Usta’sın. Arkadaş canlısı ol ama aşırı samimi, tekrarlı veya gereksiz uzun cevap verme. Kullanıcıyla günlük sohbet et, pazaryeri hakkındaki soruları yanıtla ve bir sonraki yararlı adımı öner. YükVinç üzerinden vinç, sepetli platform, manlift, çekici, iş makinesi ilanlarını keşfetme, ilan oluşturma (/ilan-ver/), iş talepleri (/is-talepleri/), ihale duyuruları (/ihale-duyurulari/), profil (/hesabim/) ve şikâyet kaydı işlevleri var. Kişiye özel hesap/ilan/ihale bilgilerine eriştiğini iddia etme. Fiyat, kapasite, stok, güncel ilan, ihale ve iletişim bilgisi uydurma; bunlar için kullanıcıyı doğru sayfaya yönlendir. Kimlik, telefon, parola isteme. İşlem yapmış gibi davranma. Kullanıcı şikâyet etmek isterse sohbet şikâyet formunu kullanabileceğini söyle. Sen admin değilsin; ilan onaylayamaz, silemez veya hesap değiştiremezsin. Sadece düz Türkçe yanıt yaz, JSON veya Markdown kodu yazma. En fazla 100 kelime.';
    const messages=[{role:'system',content:prompt},...history,{role:'user',content:redact(message)}];
    let timer;
    const result=await Promise.race([
      env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast',{messages,max_tokens:230,temperature:0.55}),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('AI timeout')),12000)})
    ]).finally(()=>clearTimeout(timer));
    const raw=result?.response??result?.output_text??result?.result??'';
    const answer=redact(safeMessage(typeof raw==='string'?raw:JSON.stringify(raw),1200));
    if(!answer)return throwFallback();
    return respond({ok:true,answer,listings:[],mode:'chat',complaint_suggestion:false});
  }catch(e){
    console.error('yv2 ai failure',e?.name||'Error');
    return respond({ok:true,answer:'Buradayım. 🙂 Daha kısa sorabilir misin? Vinç bulma, ilan verme, yeni ihaleler veya şikâyetler hakkında da yardımcı olabilirim.',listings:[],mode:'fallback'});
  }
}
function throwFallback(){return respond({ok:true,answer:'Sana yardımcı olmak isterim. Ne yapmak istediğini biraz daha anlatır mısın?',listings:[],mode:'fallback'})}
function chatPage(){
  const html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Yük Usta ile sohbet | YükVinç</title><link rel="stylesheet" href="/assets/yv-v222-extras.css?v=8"></head><body class="yv2-standalone"><header class="yv2-site-head"><a href="/">‹ YükVinç ana sayfa</a><strong>Yük Usta ✦</strong></header><main></main><script>' + CLIENT_JS + '</script></body></html>';
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
async function proxyListingWrite(request,env){
 // The original V222 Worker still authenticates and validates each write.
 // This edge gate only blocks photo-free submissions and incomplete phone numbers.
 let data;
 try{data=await request.clone().json()}catch{return error('İlan bilgileri okunamadı.',400)}
 const method=request.method;
 const category=String(data?.listing?.category||'');
 if(method==='POST'&&(!Array.isArray(data.photos)||data.photos.length<1))
  return respond({ok:false,code:'PHOTO_REQUIRED',field:'photos',message:'İlan yayınlamak için en az bir ekipman veya hizmet fotoğrafı eklemelisin.'},400);
 if(method==='PATCH'&&Array.isArray(data.photos)&&data.photos.length===0)
  return respond({ok:false,code:'PHOTO_REQUIRED',field:'photos',message:'Son fotoğrafı kaldıramazsın; yeni bir fotoğraf ekle.'},400);
 if((method==='POST'||method==='PATCH')&&data?.listing){
  const phone=data.listing.contact_phone;
  if(!validPhone(phone,category==='operator'))
   return respond({ok:false,code:'VALIDATION_FAILED',field:'contact_phone',message:'İletişim telefonunu eksiksiz gir.'},400);
 }
 const base=env.ORIGIN?await env.ORIGIN.fetch(request):await fetch(request);
 if(!base.ok||!String(base.headers.get('content-type')||'').includes('application/json'))return base;
 try{
  const data=await base.clone().json();
  if(data?.status==='pending'||data?.status==='flagged'){
   const headers=new Headers(base.headers);headers.delete('content-length');headers.set('cache-control','no-store');
   return new Response(JSON.stringify({...data,message:'İlanın kaydedildi ve kontrol ediliyor. Bilgiler uygun olduğunda kısa sürede yayına alınır.'}),{status:base.status,headers});
  }
 }catch{}
 return base;
}
async function passthrough(request,env){
  const source=env.ORIGIN?await env.ORIGIN.fetch(request):await fetch(request);
  if(!source.ok||!String(source.headers.get('content-type')||'').includes('text/html'))return source;
  const path=new URL(request.url).pathname;
  let hasTender=false;
  if(path.startsWith('/is-talepleri')){
    try{hasTender=(await publicTenders(env)).new_count>0}catch{}
  }
  const wizardStyle=path.startsWith('/ilan-ver')?'<style id="yv2-premium-wizard">.wizard-wrap{max-width:980px!important}.wizard-head{padding:20px 22px;border-radius:18px;background:linear-gradient(135deg,#f4faff,#fff);border:1px solid #dbe9f0;box-shadow:0 10px 36px rgba(11,53,79,.06)}.wizard-panel{border:1px solid #e0eaf0;background:#fff;border-radius:18px;padding:20px;margin-top:14px;box-shadow:0 7px 26px rgba(18,57,80,.05)}.wizard-panel[hidden]{display:none!important}.wizard-actions{gap:10px}.wizard-actions .button,#submit-listing{border-radius:12px;min-height:46px;font-weight:800}.wizard-progress{height:7px;border-radius:8px;overflow:hidden}.wizard-wrap [aria-invalid="true"]{border:2px solid #c12b31!important;background:#fff4f4!important;box-shadow:0 0 0 3px #c12b3119}.wizard-wrap .yv-field-error{display:block;color:#b4232c;font-size:12px;font-weight:750;margin-top:5px}#photo-dropzone.yv-invalid{border:2px dashed #c12b31!important;background:#fff4f4!important}.wizard-head .lead{max-width:55ch}</style>':'';
  const style='<style id="yv2-static-style">#yv2-float{position:fixed;right:14px;bottom:20px;z-index:2147480000;display:inline-flex;align-items:center;gap:8px;padding:13px 17px;background:#123c51;color:#fff!important;font:800 14px system-ui,Arial,sans-serif;text-decoration:none;border-radius:30px;box-shadow:0 9px 26px #123c5140}#yv2-float:focus-visible{outline:3px solid #f7b852;outline-offset:3px}#yukusta-widget{display:none!important}#yv2-tender-top{display:none!important}.offer-tabs a.yv2-tender-tab{position:relative;overflow:visible!important;white-space:nowrap}.offer-tabs a .yv2-tender-new{position:absolute;top:-10px;right:-6px;padding:2px 6px;font:800 10px system-ui,Arial;background:#b4232c;color:#fff;border-radius:7px;line-height:1.2;z-index:2}.offer-tabs{overflow:visible!important}.yv2-tender-new{background:#b4232c;color:#fff;border-radius:7px;padding:3px 7px;margin-left:7px;font:800 10px system-ui;vertical-align:middle}.yv2-tender-star{color:#e3a52a;font-weight:900;margin-left:6px}@media(max-width:640px){#yv2-float{bottom:calc(77px + env(safe-area-inset-bottom,0px));right:10px;padding:10px 13px;font-size:12px}}</style>';
  const float='<a id="yv2-float" href="/yukusta/" aria-label="Yük Usta ile sohbet et">✦ Yük Usta ile sohbet</a>';
  const apk='<section id="yv2-apk" class="yv2-app-card" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;border:1px solid #c8dee9;border-radius:14px;background:#f1f8fb;padding:16px;margin:16px 0;font-family:system-ui,Arial,sans-serif"><div><strong style="display:block;color:#193f51">📲 YükVinç Android uygulaması</strong><small style="color:#526b79">Android 0.6.0 · Resmî GitHub APK dosyası</small></div><a href="https://github.com/osmansohbet0-prog/yukbul/releases/download/yukvinc-android-v0.6.0/YukVinc-Android-0.6.0.apk" target="_blank" rel="noopener noreferrer" style="background:#133f56;color:#fff;text-decoration:none;font-weight:800;border-radius:10px;padding:11px 14px">Uygulamayı indir</a></section>';
  const tag='<span class="yv2-tender-new" aria-label="Yeni ihale">Yeni ihale</span>';
  const rewriter=new HTMLRewriter()
    .on('head',{element(e){e.append(style+wizardStyle+'<script defer src="/assets/yv-v222-extras.js?v=19"></script>',{html:true})}})
    .on('body',{element(e){e.append(float,{html:true})}})
    .on('#yv-buyer-cta-v191',{element(e){if(path==='/')e.remove()}})
    .on('#account-view',{element(e){if(path.startsWith('/hesabim'))e.prepend(apk,{html:true})}})
    .on('.offer-tabs a[href*="ihale-duyurulari"]',{element(e){e.setAttribute('class',[(e.getAttribute('class')||''),'yv2-tender-tab'].filter(Boolean).join(' '));e.setInnerContent('İhaleler',{html:false});if(hasTender){e.setAttribute('aria-label','İhaleler — yeni ihale var');e.append(tag,{html:true});}}})
    .on('.wizard-head h1',{element(e){if(path.startsWith('/ilan-ver'))e.setInnerContent('İlanını 4 kolay adımda yayınla.') }})
    .on('.wizard-head .lead',{element(e){if(path.startsWith('/ilan-ver'))e.setInnerContent('Bilgilerini ekle, net fotoğraflarını yükle ve ilanını gönder. Kontrolü geçen ilanlar kısa sürede yayına alınır.') }})
    .on('#step-title',{element(e){if(path.startsWith('/ilan-ver'))e.setInnerContent('1 / 4 · Tür ve konum') }})
    .on('#submit-listing',{element(e){if(path.startsWith('/ilan-ver'))e.setInnerContent('İlanı gönder ↗') }})
    .on('#photo-dropzone .optional-tag',{element(e){if(path.startsWith('/ilan-ver'))e.setInnerContent('1–3 fotoğraf · zorunlu') }})
    .on('script[src="/assets/listing-form.js"]',{element(e){if(path.startsWith('/ilan-ver'))e.setAttribute('src','/assets/yv-v222-listing-form.js?v=19') }});
  return rewriter.transform(source);
}
export default {
  async fetch(request,env){
    try{
      const u=new URL(request.url),path=u.pathname;
      if(path==='/yukusta'||path==='/yukusta/')return chatPage();
      if(path===CLIENT_ROUTE)return new Response(CLIENT_JS,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'public,max-age=300','x-content-type-options':'nosniff'}});
      if(path===CSS_ROUTE)return new Response(CLIENT_CSS,{headers:{'content-type':'text/css; charset=utf-8','cache-control':'public,max-age=300','x-content-type-options':'nosniff'}});
      if(path===FORM_ROUTE)return new Response(FORM_SCRIPT,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
      if(path.startsWith(API_PREFIX)){
        if(!env.DB)return error('Yük Usta veritabanına ulaşılamıyor.',503);
        const name=path.slice(API_PREFIX.length);
        if(name==='health'&&request.method==='GET')return respond({ok:true,version:VERSION,ai:!!env.AI,db:!!env.DB,origin:!!env.ORIGIN});
        if(name==='tenders'&&request.method==='GET')return respond(await publicTenders(env));
        if(name==='report')return report(request,env);
        if(name==='chat')return chat(request,env);
        return error('Adres bulunamadı.',404);
      }
      if((request.method==='POST'&&(path==='/api/listings'||path==='/api/listings/'))||(request.method==='PATCH'&&/^\/api\/listings\/[A-Za-z0-9_-]{8,80}$/.test(path)))return proxyListingWrite(request,env);
      if(request.method==='GET'||request.method==='HEAD')return passthrough(request,env);
      return env.ORIGIN?env.ORIGIN.fetch(request):fetch(request);
    }catch(err){console.error('yv2 route error',err?.name||'Error');return error('Yük Usta geçici olarak kullanılamıyor.',503)}
  },
  async scheduled(_controller,env,ctx){
    ctx.waitUntil(runAutoReview(env).catch(e=>console.error('listing-auto-review',e?.name||'Error')));
  }
};
