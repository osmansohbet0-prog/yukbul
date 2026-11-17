/* YükVinç V222 additive Worker. Primary 'yukbul' script and admin/radar routing stay untouched.
   Package step replaces the two placeholder JS string literals with repo edge assets. */
const CLIENT_JS = '__INJECT_CLIENT_JS__';
const CLIENT_CSS = '__INJECT_CLIENT_CSS__';
const CORS_ORIGIN = 'https://yukvinc.com.tr';
const VERSION = 'v222-extras-20261117.5';
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
  const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM lead_radar_leads WHERE status='approved' AND public_at IS NOT NULL AND public_at >= unixepoch()-172800 AND (public_expires_at IS NULL OR public_expires_at>unixepoch())").first();
  return {ok:true,new_count:Number(row?.n||0)};
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
async function passthrough(request,env){
  // The original V222 Worker stays intact; add only a scoped, nonce-authorized chat script.
  const source=env.ORIGIN?await env.ORIGIN.fetch(request):await fetch(request);
  if(!source.ok||!String(source.headers.get('content-type')||'').includes('text/html'))return source;
  const nonce=crypto.randomUUID().replaceAll('-','');
  const headers=new Headers(source.headers);
  const csp=headers.get('content-security-policy');
  if(csp){
    const scriptMatch=/(^|;[ ]*)script-src[ ]+([^;]*)/;
    if(scriptMatch.test(csp))headers.set('content-security-policy',csp.replace(scriptMatch,(all,prefix,values)=>prefix+'script-src '+values+" 'nonce-"+nonce+"'"));
  }
  headers.delete('content-length');
  const response=new Response(source.body,{status:source.status,statusText:source.statusText,headers});
  const rewriter=new HTMLRewriter().on('head',{element(element){
    element.append('<script nonce="'+nonce+'">'+CLIENT_JS+'</script>',{html:true});
  }});
  return rewriter.transform(response);
}
export default {
  async fetch(request,env){
    try{
      const u=new URL(request.url),path=u.pathname;
      if(path===CLIENT_ROUTE)return new Response(CLIENT_JS,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'public,max-age=300','x-content-type-options':'nosniff'}});
      if(path===CSS_ROUTE)return new Response(CLIENT_CSS,{headers:{'content-type':'text/css; charset=utf-8','cache-control':'public,max-age=300','x-content-type-options':'nosniff'}});
      if(path.startsWith(API_PREFIX)){
        if(!env.DB)return error('Yük Usta veritabanına ulaşılamıyor.',503);
        const name=path.slice(API_PREFIX.length);
        if(name==='health'&&request.method==='GET')return respond({ok:true,version:VERSION,ai:!!env.AI,db:!!env.DB,origin:!!env.ORIGIN});
        if(name==='tenders'&&request.method==='GET')return respond(await publicTenders(env));
        if(name==='report')return report(request,env);
        if(name==='chat')return chat(request,env);
        return error('Adres bulunamadı.',404);
      }
      if(request.method==='GET'||request.method==='HEAD')return passthrough(request,env);
      return env.ORIGIN?env.ORIGIN.fetch(request):fetch(request);
    }catch(err){console.error('yv2 route error',err?.name||'Error');return error('Yük Usta geçici olarak kullanılamıyor.',503)}
  }
};
