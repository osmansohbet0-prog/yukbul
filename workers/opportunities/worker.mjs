const ORIGIN = 'https://yukvinc.com.tr';
export const NEW_SECONDS = 72 * 3600;
export function isNew(published, now = Math.floor(Date.now() / 1000)) {
  const timestamp = Number(published);
  return timestamp > 0 && timestamp <= now && now - timestamp < NEW_SECONDS;
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const date = timestamp => new Intl.DateTimeFormat('tr-TR', {dateStyle:'medium', timeZone:'Europe/Istanbul'}).format(Number(timestamp) * 1000);
const styles = `*{box-sizing:border-box}body{margin:0;background:#f5f6f8;color:#172d35;font:16px system-ui,sans-serif}a{color:inherit}header,main,footer{max-width:1060px;margin:auto;padding:22px}header{display:flex;justify-content:space-between;gap:16px;align-items:center}.brand{font-size:23px;font-weight:800;text-decoration:none}h1{font-size:clamp(28px,5vw,40px);margin:12px 0}h2{font-size:20px;line-height:1.45;margin:12px 0}p{line-height:1.65}.tabs{display:flex;gap:8px;margin:22px 0;flex-wrap:wrap}.tabs a,.button,button{display:inline-block;padding:12px 18px;border-radius:9px;background:#172d35;color:white;text-decoration:none;border:0;font:inherit;cursor:pointer}.tabs a{background:white;color:#172d35;border:1px solid #dce1e5}.tabs [aria-current]{background:#172d35;color:white}form.filters{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:12px;align-items:end;background:white;border:1px solid #dce1e5;border-radius:12px;padding:18px}label{display:grid;gap:7px}input,select{font:inherit;padding:11px;border:1px solid #bec9ce;border-radius:7px;width:100%;min-height:44px}.results{display:flex;justify-content:space-between;gap:15px;align-items:center}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.card{background:white;border:1px solid #dce1e5;padding:22px;border-radius:12px;display:flex;flex-direction:column;align-items:start}.card .button{margin-top:auto}.meta{color:#52636b;font-size:14px}.new{background:#dff4e5;color:#175e31;border-radius:6px;padding:5px 9px;font-size:13px;font-weight:700}.deadline{font-weight:650}details{margin:15px 0}summary{cursor:pointer;line-height:1.6}footer{font-size:14px;display:flex;gap:20px;flex-wrap:wrap}:focus-visible{outline:3px solid #e08b34;outline-offset:3px}.preference{background:white;padding:24px;border-radius:12px;max-width:680px}.preference label{display:flex;align-items:center;margin:20px 0}.preference input{width:auto;min-height:auto}@media(max-width:680px){form.filters,.cards{grid-template-columns:1fr}.results{align-items:start;flex-direction:column}header,main,footer{padding:16px}.card{padding:18px}}`;
function navigation(tenders = true) {
  return '<nav class="'+(tenders?'tabs':'offer-tabs')+'" aria-label="İş bölümleri"><a href="/ihale-duyurulari/"'+(tenders?' aria-current="page"':'')+'>İhaleler</a><a href="/is-talepleri/"'+(!tenders?' aria-current="page"':'')+'>İş talepleri</a><a href="/ihale-bildirimleri/">E-posta bildirimleri</a></nav>';
}
function page(title, content, status = 200) {
  return new Response('<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | YükVinç</title><style>'+styles+'</style></head><body><header><a class="brand" href="/">YükVinç</a><a href="/hesabim/">Hesabım</a></header><main>'+content+'</main><footer><a href="/">Makine ilanları</a><a href="/iletisim/">İletişim</a><a href="/gizlilik/">Gizlilik</a></footer></body></html>', {status, headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'x-yv-opportunities':'20261117'}});
}
export async function tenderPage(request, env) {
  const params = new URL(request.url).searchParams;
  const city = (params.get('il') || '').slice(0,80);
  const search = (params.get('q') || '').trim().slice(0,120);
  const recent = params.get('yeni') === '1';
  const now = Math.floor(Date.now()/1000);
  const conditions = ["status='approved'",'public_at IS NOT NULL','public_at<=?','public_expires_at>?'];
  const args = [now,now];
  if(city){conditions.push('city=?');args.push(city)}
  if(search){conditions.push("(instr(lower(title),lower(?))>0 OR instr(lower(COALESCE(organization,'')),lower(?))>0)");args.push(search,search)}
  if(recent){conditions.push('public_at>?');args.push(now-NEW_SECONDS)}
  const [{results:rows=[]},{results:cities=[]}] = await Promise.all([
    env.DB.prepare('SELECT id,title,organization,city,service_type,public_summary,public_at,public_expires_at FROM lead_radar_leads WHERE '+conditions.join(' AND ')+' ORDER BY public_at DESC,id LIMIT 100').bind(...args).all(),
    env.DB.prepare("SELECT DISTINCT city FROM lead_radar_leads WHERE status='approved' AND public_at<=? AND public_expires_at>? AND city IS NOT NULL ORDER BY city").bind(now,now).all()
  ]);
  const options = cities.map(item=>'<option'+(city===item.city?' selected':'')+'>'+esc(item.city)+'</option>').join('');
  const cards = rows.map(row=>'<article class="card">'+(isNew(row.public_at,now)?'<span class="new">Yeni paylaşıldı</span>':'')+'<h2>'+esc(row.title)+'</h2><div class="meta">'+esc(row.city||'Türkiye geneli')+' · '+esc(row.organization||'Resmî kurum')+'</div><p>'+esc(String(row.public_summary||row.service_type||'').slice(0,240))+'</p><p class="deadline">Son başvuru '+date(row.public_expires_at)+'</p><p class="meta">YükVinç’te paylaşım '+date(row.public_at)+'</p><a class="button" href="/ihale-basvuru/'+encodeURIComponent(row.id)+'/">Başvuru bilgileri →</a></article>').join('');
  return page('İhaleler','<h1>İhaleler</h1><p>Yeni paylaşılanlar en üstte. Başvuru koşullarını ilgili kurumun duyurusundan inceleyin.</p>'+navigation()+'<form class="filters" method="get"><label>İhale ara<input name="q" value="'+esc(search)+'" placeholder="Vinç, platform veya kurum adı"></label><label>Şehir<select name="il"><option value="">Tüm şehirler</option>'+options+'</select></label><label>Paylaşım<select name="yeni"><option value="">Tümü</option><option value="1"'+(recent?' selected':'')+'>Son 72 saat</option></select></label><button>Filtrele</button></form><div class="results"><p>'+rows.length+(rows.length===100?'+':'')+' güncel ihale</p><a href="/ihale-bildirimleri/">Yeni ihaleler e-postama gelsin</a></div><section class="cards" aria-label="İhaleler">'+(cards||'<p>Bu filtrelerde güncel ihale bulunamadı. <a href="/ihale-duyurulari/">Filtreleri temizle</a></p>')+'</section>');
}
async function member(request,env){
  const raw=(request.headers.get('cookie')||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('__Host-yv_member='));
  if(!raw)return null;
  let token;try{token=decodeURIComponent(raw.slice('__Host-yv_member='.length))}catch{return null}
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),byte=>byte.toString(16).padStart(2,'0')).join('');
  return env.DB.prepare("SELECT u.id,u.email_notifications FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>unixepoch() AND u.active=1 AND u.role='member'").bind(hash).first();
}
async function preferences(request,env){
  const url=new URL(request.url);
  const token=(url.searchParams.get('token')||'').slice(0,80);
  const user=token?await env.DB.prepare('SELECT u.id,u.email_notifications FROM tender_email_preferences p JOIN users u ON u.id=p.user_id WHERE p.unsubscribe_token=?').bind(token).first():await member(request,env);
  if(!user)return page('İhale bildirimleri','<h1>İhale bildirimleri</h1><p>Bildirim tercihini değiştirmek için hesabına giriş yap.</p><a class="button" href="/giris/?next=%2Fihale-bildirimleri%2F">Giriş yap</a>',401);
  if(request.method==='POST'){
    if(request.headers.get('origin')!==url.origin)return page('İstek reddedildi','<p>Sayfayı yenileyip tekrar deneyin.</p>',403);
    const form=await request.formData();
    const enabled=token?0:Number(form.get('enabled')==='1');
    await env.DB.prepare('INSERT INTO tender_email_preferences(user_id,enabled,unsubscribe_token,subscribed_at) VALUES(?,?,?,unixepoch()) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,subscribed_at=CASE WHEN tender_email_preferences.enabled=0 AND excluded.enabled=1 THEN unixepoch() ELSE tender_email_preferences.subscribed_at END').bind(user.id,enabled,crypto.randomUUID()).run();
    return page('Tercih kaydedildi','<h1>Tercihin kaydedildi</h1><p>'+ (enabled?'Yeni ihale bildirimleri açıldı.':'İhale e-posta bildirimleri kapatıldı.')+'</p><a class="button" href="/ihale-duyurulari/">İhalelere dön</a>');
  }
  const preference=await env.DB.prepare('SELECT enabled FROM tender_email_preferences WHERE user_id=?').bind(user.id).first();
  return page('İhale bildirimleri','<h1>İhale bildirimleri</h1>'+navigation()+'<section class="preference"><form method="post">'+(token?'<p>Yeni ihale e-postalarını kapatmak için onayla.</p><button>İhale bildirimlerini kapat</button>':'<p>Yeni paylaşılan ihalelerin başlığı, şehri ve başvuru bağlantısı e-postana gönderilir.</p><label><input type="checkbox" name="enabled" value="1"'+(user.email_notifications&&(preference?.enabled??1)?' checked':'')+'> Yeni ihaleleri e-postayla bildir</label>'+(!user.email_notifications?'<p>Hesabım sayfasından genel e-posta bildirimlerini de açmalısın.</p>':'')+'<button>Tercihi kaydet</button>')+'</form></section>');
}
export async function dispatchNotifications(env){
  if(!env.EMAIL||!env.NOTIFICATION_FROM)throw Error('İhale e-posta göndericisi yapılandırılmamış.');
  const now=Math.floor(Date.now()/1000);
  const state=await env.DB.prepare("SELECT activated_at FROM tender_notification_state WHERE id=1").first();
  if(!state)throw Error('Bildirim başlangıcı ayarlanmamış.');
  await env.DB.prepare("INSERT OR IGNORE INTO tender_email_preferences(user_id,enabled,unsubscribe_token,subscribed_at) SELECT id,1,lower(hex(randomblob(24))),MAX(?,created_at) FROM users WHERE role='member' AND active=1 AND email_notifications=1").bind(state.activated_at).run();
  await env.DB.prepare("INSERT OR IGNORE INTO tender_email_outbox(user_id,lead_id,status,created_at) SELECT u.id,l.id,'queued',? FROM users u JOIN tender_email_preferences p ON p.user_id=u.id JOIN lead_radar_leads l ON l.public_at>MAX(?,p.subscribed_at) WHERE u.active=1 AND u.email_notifications=1 AND p.enabled=1 AND l.status='approved' AND l.public_at<=? AND l.public_expires_at>? AND NOT EXISTS(SELECT 1 FROM tender_email_outbox o WHERE o.user_id=u.id AND o.lead_id=l.id) ORDER BY l.public_at LIMIT 1000").bind(now,state.activated_at,now,now).run();
  const {results:pending=[]}=await env.DB.prepare("SELECT user_id,lead_id FROM tender_email_outbox WHERE status='queued' ORDER BY created_at LIMIT 10").all();
  for(const item of pending){
    const claim=await env.DB.prepare("UPDATE tender_email_outbox SET status='sending',attempted_at=unixepoch() WHERE user_id=? AND lead_id=? AND status='queued'").bind(item.user_id,item.lead_id).run();
    if(!claim.meta?.changes)continue;
    const row=await env.DB.prepare("SELECT u.email,p.unsubscribe_token,l.title,l.city,l.public_expires_at FROM users u JOIN tender_email_preferences p ON p.user_id=u.id JOIN lead_radar_leads l ON l.id=? WHERE u.id=? AND u.active=1 AND u.email_notifications=1 AND p.enabled=1 AND l.status='approved' AND l.public_expires_at>unixepoch()").bind(item.lead_id,item.user_id).first();
    if(!row){await env.DB.prepare("UPDATE tender_email_outbox SET status='cancelled' WHERE user_id=? AND lead_id=?").bind(item.user_id,item.lead_id).run();continue}
    const link=ORIGIN+'/ihale-basvuru/'+encodeURIComponent(item.lead_id)+'/';
    const unsubscribe=ORIGIN+'/ihale-bildirimleri/?token='+encodeURIComponent(row.unsubscribe_token);
    try{
      await env.EMAIL.send({from:{email:env.NOTIFICATION_FROM,name:'YükVinç'},to:row.email,subject:'Yeni ihale · '+String(row.title).replace(/[\r\n]/g,' ').slice(0,130),text:'YükVinç’te yeni paylaşıldı\n\n'+row.title+'\n'+(row.city||'Türkiye geneli')+'\nSon başvuru '+date(row.public_expires_at)+'\n'+link+'\n\nİhale bildirimlerini kapat\n'+unsubscribe,html:'<p>YükVinç’te yeni paylaşıldı</p><h1>'+esc(row.title)+'</h1><p>'+esc(row.city||'Türkiye geneli')+'</p><p>Son başvuru '+date(row.public_expires_at)+'</p><p><a href="'+link+'">Başvuru bilgilerini aç</a></p><p><a href="'+esc(unsubscribe)+'">İhale bildirimlerini kapat</a></p>'});
    }catch(error){
      // A network failure can occur after acceptance. Keep it out of automatic retries.
      await env.DB.prepare("UPDATE tender_email_outbox SET status='uncertain',error_code=? WHERE user_id=? AND lead_id=?").bind(String(error.code||'send_failed').slice(0,80),item.user_id,item.lead_id).run();
      console.error('tender_email_send_failed',error.code||'unknown');continue;
    }
    await env.DB.prepare("UPDATE tender_email_outbox SET status='sent',sent_at=unixepoch() WHERE user_id=? AND lead_id=? AND status='sending'").bind(item.user_id,item.lead_id).run();
  }
}
export function simplifyJobScript(source){
  if(!source.includes('function siteOfferHeader()')||!source.includes('function jobsPage()'))return source;
  return source.replace(/function siteOfferHeader\(\)\{[\s\S]*?(?=function jobsPage\(\))/,'function siteOfferHeader(){return '+JSON.stringify('<header class="offer-hub"><div><h1>İş talepleri</h1><p>İşini paylaş, gelen teklifleri hesabından incele.</p></div><a class="button primary" href="#create">İş talebi oluştur</a></header>'+navigation(false))+'}\n').replace("visible.length+' duyuru'","visible.length+' iş talebi'");
}
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    try{
      if(path.replace(/\/$/,'')==='/ihale-bildirimleri'&&['GET','POST'].includes(request.method))return preferences(request,env);
      if(path.replace(/\/$/,'')==='/ihale-duyurulari'&&['GET','HEAD'].includes(request.method)){
        const response=await tenderPage(request,env);
        return request.method==='HEAD'?new Response(null,{headers:response.headers}):response;
      }
      const response=await env.YUKBUL.fetch(request);
      if(request.method!=='GET'||!response.ok)return response;
      if(path==='/assets/job-board-v20261102private.js'){
        const headers=new Headers(response.headers);
        for(const name of ['content-length','content-encoding','etag','last-modified'])headers.delete(name);
        headers.set('cache-control','no-cache');headers.set('content-type','application/javascript; charset=utf-8');
        return new Response(simplifyJobScript(await response.text()),{headers});
      }
      if(path==='/is-talepleri/'&&response.headers.get('content-type')?.includes('text/html')){
        const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');headers.set('cache-control','no-store');
        return new HTMLRewriter().on('head',{element(el){el.append('<style>.content-grid{grid-template-columns:minmax(0,1fr)!important}.list-sidebar{display:none!important}.offer-tabs{display:flex;flex-wrap:wrap;gap:10px}.offer-tabs a{padding:12px 16px}.offer-tabs [aria-current]{font-weight:700}.job-snippet{line-height:1.6}</style>',{html:true})}}).on('#job-ssr .offer-hub h1',{element(el){el.setInnerContent('İş talepleri')}}).on('#job-ssr .offer-tabs',{element(el){el.replace(navigation(false),{html:true})}}).transform(new Response(response.body,{headers}));
      }
      return response;
    }catch(error){console.error('opportunities_failed',error.name);return page('Şu anda yüklenemedi','<h1>Sayfa şu anda yüklenemedi.</h1><p>Biraz sonra tekrar deneyin.</p>',503)}
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(dispatchNotifications(env))}
};
