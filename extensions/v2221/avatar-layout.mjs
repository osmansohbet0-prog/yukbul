const CSS=`img[src^="/api/public-member-avatar/"]{border-radius:50%;object-fit:cover}
.detail-seller{display:flex;align-items:center;gap:12px}
.detail-seller img.detail-seller-avatar{display:block;width:52px;height:52px;flex:0 0 52px;aspect-ratio:1;object-fit:cover;border-radius:50%}
.detail-seller>div{min-width:0}`;

export function withAvatarLayout(base){return {...base,async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  if(path==='/assets/yv-avatar-layout-v1.css')return new Response(CSS,{headers:{'content-type':'text/css; charset=utf-8','cache-control':'public, max-age=31536000, immutable'}});
  const response=await base.fetch(request,env,ctx);
  if(request.method!=='GET'||!response.ok||!response.headers.get('content-type')?.includes('text/html'))return response;
  if(path!=='/'&&!path.startsWith('/ilan/')&&!path.startsWith('/kategori/')&&!path.startsWith('/sehir/'))return response;
  return new HTMLRewriter().on('head',{element(e){e.append('<link rel="stylesheet" href="/assets/yv-avatar-layout-v1.css">',{html:true})}}).transform(response);
}}}

