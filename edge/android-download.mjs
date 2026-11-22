const releases = 'https://api.github.com/repos/osmansohbet0-prog/yukbul/releases';
const fallback = {version: '1.3.2', size: 56072359, id: 776777804};
const versionOrder = (a,b) => a.localeCompare(b, 'en', {numeric: true});

async function latestAndroid() {
  let best = fallback;
  try {
    const r = await fetch(releases + '?per_page=30', {
      headers: {'User-Agent':'YukVinc-Android-Download', Accept:'application/vnd.github+json'},
      cf: {cacheEverything:true, cacheTtl:300}, signal:AbortSignal.timeout(3500),
    });
    if (!r.ok) return best;
    for (const release of await r.json()) {
      const version = /^yukvinc-android-v(\d{1,5}\.\d{1,5}\.\d{1,5})$/.exec(release.tag_name)?.[1];
      if (release.draft || release.prerelease || !version || versionOrder(version,best.version) <= 0) continue;
      const name = 'YukVinc-Android-' + version + '.apk';
      const assets = release.assets.filter(a => a.state === 'uploaded' && a.size > 0);
      const apk = assets.find(a => a.name === name);
      if (apk && Number.isSafeInteger(apk.id) && assets.some(a => a.name === name + '.sha256')) {
        best = {version, size:apk.size, id:apk.id};
      }
    }
  } catch { /* The last verified release is still available. */ }
  return best;
}

export async function androidDownload(request) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  const {version, size, id} = await latestAndroid();
  const name = 'YukVinc-Android-' + version + '.apk';
  const direct = 'https://github.com/osmansohbet0-prog/yukbul/releases/download/yukvinc-android-v' + version + '/' + name;
  const headers = new Headers({Accept:'application/octet-stream', 'User-Agent':'YukVinc-Android-Download'});
  for (const key of ['range','if-range']) if (request.headers.has(key)) headers.set(key,request.headers.get(key));
  for (const url of [direct, releases + '/assets/' + id]) {
    try {
      const upstream = await fetch(url,{method:request.method, headers, redirect:'follow'});
      const length = upstream.headers.get('content-length');
      const range = upstream.headers.get('content-range');
      const full = upstream.status === 200 && Number(length) === size;
      const part = upstream.status === 206 && range?.endsWith('/' + size);
      if (upstream.status === 416 && headers.has('range')) {
        return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
      }
      if (!full && !part) { await upstream.body?.cancel(); continue; }
      const output = new Headers({'Content-Disposition':'attachment; filename="'+name+'"',
        'Content-Type':'application/vnd.android.package-archive','Cache-Control':'no-store, no-transform',
        'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'});
      for (const key of ['content-length','content-range','etag','last-modified']) {
        if (upstream.headers.has(key)) output.set(key,upstream.headers.get(key));
      }
      return new Response(upstream.body,{status:upstream.status,headers:output});
    } catch { /* Try the second official GitHub asset endpoint. */ }
  }
  return new Response(null,{status:302,headers:{Location:direct,'Cache-Control':'no-store'}});
}
