/**
 * Isolated YükVinç Radar 3.0 staging diagnostics.
 * No production data, no automated feed fetching, AI calls, cron or outbound messages.
 */
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' };
function json(data, status = 200) { return new Response(JSON.stringify(data), {status, headers: JSON_HEADERS}); }
function normalize(value) {
  return String(value || '').toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
const EXCLUSIONS = [
  /\b(satilik|satisa sunuldu|ikinci el satilik)\b/,
  /\b(operatoru?|personel|eleman|soforu?|is gucu)\s+(araniyor|alinacak|ihtiyaci)\b/,
  /\b(hizmet\s+veriyoruz|kiralik\s+(vinc|makine|platform)lerimiz|filomuzda|hizmetinizde)\b/
];
const INTENT = /\b(lazim|araniyor|ihtiyac|ihtiyaci|kiralanacaktir|hizmet alimi|teklif alinacaktir|ihalesi|talep ediliyor)\b/;

async function readRows(db, sql) {
  return (await db.prepare(sql).all()).results || [];
}
async function getState(db) {
  const [profiles, rules, sources, leads, runs] = await Promise.all([
    readRows(db, 'SELECT priority,COUNT(*) AS count FROM radar_search_profiles GROUP BY priority ORDER BY priority'),
    readRows(db, 'SELECT category,COUNT(*) AS count FROM radar_keyword_rules WHERE enabled=1 GROUP BY category ORDER BY category'),
    readRows(db, 'SELECT COUNT(*) AS count,SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) AS active FROM lead_radar_sources'),
    readRows(db, 'SELECT COUNT(*) AS count FROM lead_radar_leads'),
    readRows(db, 'SELECT COUNT(*) AS count FROM lead_radar_scan_runs')
  ]);
  return {
    stage: 'radar-3-diagnostics', production: false, automatedScanning: false,
    googleAlertsConfigured: (sources[0]?.active || 0) > 0, realAiTested: false,
    provinceProfiles: profiles.reduce((n, x) => n + x.count, 0),
    priorities: profiles, keywordRules: rules, sources: sources[0]?.count || 0,
    activeSources: sources[0]?.active || 0, candidates: leads[0]?.count || 0,
    scans: runs[0]?.count || 0, completeV167Site: false
  };
}
async function preview(db, text) {
  if (typeof text !== 'string' || text.trim().length < 8 || text.length > 3000) {
    return { error: 'sample_length_must_be_8_to_3000_characters', status: 400 };
  }
  const normalized = normalize(text);
  if (EXCLUSIONS.some(p => p.test(normalized))) {
    return {status: 'rejected', classification: 'advertisement_or_job_or_sale', matchedCategory: null, aiUsed: false, published: false};
  }
  const rules = await readRows(db, "SELECT category,phrase,normalized_phrase FROM radar_keyword_rules WHERE enabled=1 AND rule_type='include' ORDER BY category");
  const matches = rules.filter(r => normalized.includes(r.normalized_phrase));
  const categories = [...new Set(matches.map(r => r.category))];
  return {
    status: categories.length && INTENT.test(normalized) ? 'needs_review' : 'unmatched',
    matchedCategories: categories,
    matchingRules: matches.slice(0, 8).map(r => r.phrase),
    verifiedCustomer: false, aiUsed: false, published: false,
    explanation: 'Rule-based prefilter only. This is not an AI verification or a confirmed customer lead.'
  };
}
function page() {
  const html = '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>YukVinc Radar Staging</title><style>' +
    'body{margin:0;background:#0c1525;color:#eff6ff;font:16px/1.55 system-ui,sans-serif}main{max-width:980px;margin:auto;padding:24px}' +
    'h1{font-size:clamp(24px,5vw,38px);line-height:1.12}h2{font-size:19px}p,small{color:#acbed2}' +
    'section{background:#172439;border:1px solid #2c3d56;border-radius:14px;padding:19px;margin:16px 0}' +
    '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px}.metric{background:#101d30;padding:15px;border-radius:10px}' +
    '.metric b{font-size:27px;display:block;color:#a8e6ff}textarea{width:100%;box-sizing:border-box;min-height:115px;background:#0a1423;color:#fff;' +
    'border:1px solid #53657a;border-radius:9px;padding:12px}button{background:#58c1e6;color:#062035;padding:11px 19px;border:0;' +
    'font-weight:700;border-radius:9px;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#0b1626;padding:12px;border-radius:9px}' +
    'code{color:#8ed9ff}</style><main><h1>YukVinc Is Radari — Staging</h1>' +
    '<p>Bu yalnizca izole radar test arayuzudur. Tam V167 sitesi degildir. Gercek RSS, AI, otomatik yayin ve cron etkin degildir.</p>' +
    '<section><h2>Durum</h2><div id="metrics" class="grid">Yukleniyor...</div></section>' +
    '<section><h2>Ornek talep on kontrolu</h2><p>Yalnizca kural tabanli siniflandirma. Gercek musteri dogrulamasi yapmaz.</p>' +
    '<textarea id="sample" maxlength="3000" placeholder="Gebze&#39;de yarin vinc lazim..."></textarea><p><button id="check">Analiz et</button></p><pre id="result">Henüz ornek girilmedi.</pre></section>' +
    '<section><h2>Test API adresleri</h2><p><code>/health</code> · <code>/api/radar/status</code> · ' +
    '<code>/api/radar/profiles</code> · <code>/api/radar/keywords</code></p>' +
    '<small>Staging izole kalir: canli D1, e-posta, Cron ve ucretli AI cagrisi yok.</small></section></main>' +
    '<script>' +
    'const m=document.getElementById("metrics"),out=document.getElementById("result");' +
    'fetch("/api/radar/status").then(r=>r.json()).then(d=>{' +
    'm.textContent="";for(const [k,v] of Object.entries({' +
    '"Il profili":d.provinceProfiles,"Anahtar kelime kurali":d.keywordRules.reduce((s,x)=>s+x.count,0),' +
    '"Aktif kaynak":d.activeSources,"Aday":d.candidates,"Tarama":d.scans})){' +
    'const item=document.createElement("div");item.className="metric";' +
    'const b=document.createElement("b");b.textContent=v;' +
    'const t=document.createElement("span");t.textContent=k;item.append(b,t);m.append(item)}' +
    '}).catch(()=>{m.textContent="Veri alinamadi";});' +
    'document.getElementById("check").addEventListener("click",async()=>{' +
    'out.textContent="Analiz ediliyor...";try{const r=await fetch("/api/radar/preview",{method:"POST",headers:{"Content-Type":"application/json"},' +
    'body:JSON.stringify({text:document.getElementById("sample").value})});out.textContent=JSON.stringify(await r.json(),null,2)}' +
    'catch{out.textContent="Islem basarisiz";}});' +
    '</script></html>';
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
    'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'"}});
}

// Temporary staging-only publisher feed reachability check.
// All endpoints are pinned to publisher-listed hostnames. No user-supplied URLs.
const PROBE_IDS = [
  'dto-sirkuler-rss',
  'dto-haberler-rss',
  'tobb-ihale-rss'
];
const PROBE_URLS = Object.freeze({
  'dto-sirkuler-rss':'https://www.denizticaretodasi.org.tr/tr/rss/sirkuler',
  'dto-haberler-rss':'https://www.denizticaretodasi.org.tr/tr/rss/haberler',
  'tobb-ihale-rss':'https://ihale.tobb.org.tr/yeni/RssIhale.php'
});
async function readLimitedRssBody(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('no_response_body');
  const buffers = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 256000) throw new Error('feed_over_256kb');
      buffers.push(chunk.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of buffers) { bytes.set(part, offset); offset += part.byteLength; }
  return new TextDecoder('utf-8').decode(bytes);
}
async function probePublisherFeeds(env) {
  const rows = (await env.DB.prepare("SELECT id,feed_url FROM lead_radar_sources WHERE id IN ('dto-sirkuler-rss','dto-haberler-rss','tobb-ihale-rss')").all()).results || [];
  const results = await Promise.all(rows.map(async row => {
    const expected = PROBE_URLS[row.id];
    if (!expected || row.feed_url !== expected) return {id:row.id,ok:false,status:'URL mismatch'};
    let count = 0, status = 'unknown', success = false;
    try {
      const res = await fetch(expected, {method:'GET',redirect:'manual',
        signal:AbortSignal.timeout(7000),
        headers:{Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.8'}});
      if (res.status !== 200) throw new Error('HTTP_'+res.status);
      if (Number(res.headers.get('content-length') || 0) > 256000) throw new Error('feed_over_256kb');
      const body = await readLimitedRssBody(res);
      if (!/<(?:rss\b|feed\b|rdf:RDF\b)/i.test(body.slice(0,1200))) throw new Error('not_RSS_or_Atom');
      count = (body.match(/<(?:item|entry)(?:\s|>)/gi)||[]).length;
      status = 'PROBE_OK RSS/XML · '+count+' entries · republish not authorized';
      success = true;
    } catch(e) { status = 'PROBE_FAILED '+String(e?.message||e).slice(0,140); }
    await env.DB.prepare('UPDATE lead_radar_sources SET last_scan_status=?,last_scan_count=?,last_scan_at=?,last_success_at=CASE WHEN ? THEN unixepoch() ELSE last_success_at END,updated_at=unixepoch() WHERE id=? AND enabled=0')
      .bind(status,count,Math.floor(Date.now()/1000),success?1:0,row.id).run();
    return {id:row.id,ok:success,status};
  }));
  return results;
}

export default {
  async scheduled(controller, env, ctx) {
    if (!env.DB) return;
    ctx.waitUntil(probePublisherFeeds(env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'GET' && path === '/') return page();
    if (!env.DB) return json({ error:'staging_db_missing' },503);
    try {
      if (request.method === 'GET' && ['/health','/healthz','/api/staging/health'].includes(path)) {
        const n = await readRows(env.DB, 'SELECT COUNT(*) AS count FROM radar_search_profiles');
        return json({ok:true,stageOnly:true,previewDatabase:true,provinceProfiles:n[0]?.count||0,aiBound:!!env.AI,aiCalled:false,cronEnabled:false});
      }
      if (request.method === 'GET' && path === '/api/radar/status') return json(await getState(env.DB));
      if (request.method === 'GET' && path === '/api/radar/profiles') {
        return json({profiles:await readRows(env.DB,'SELECT p.province_code,p.priority,p.enabled,p.scan_interval_seconds,l.province_name FROM radar_search_profiles p JOIN lead_radar_provinces l ON l.province_code=p.province_code ORDER BY p.priority,p.province_code')});
      }
      if (request.method === 'GET' && path === '/api/radar/keywords') {
        return json({rules:await readRows(env.DB,"SELECT category,phrase,rule_type,enabled FROM radar_keyword_rules ORDER BY category,phrase")});
      }
      if (request.method === 'POST' && path === '/api/radar/preview') {
        const length = Number(request.headers.get('content-length')||0);
        if (length > 4096) return json({error:'body_too_large'},413);
        const bodyText = await request.text();
        if (bodyText.length > 4096) return json({error:'body_too_large'},413);
        let body;
        try { body = JSON.parse(bodyText); } catch { return json({error:'invalid_json'},400); }
        const verdict = await preview(env.DB,body?.text);
        if (verdict.error) return json({error:verdict.error},verdict.status);
        return json(verdict);
      }
      return json({error:'not_found'},404);
    } catch {
      return json({error:'staging_query_failed'},503);
    }
  }
};
