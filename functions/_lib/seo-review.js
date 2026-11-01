import {localGuides,homeIntroduction} from './seo-content.js';
import {normalizePageSeo,publicDiscoveryFooter} from './seo-metadata.js';
import {iconTags,citySlug} from './discovery.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizeSeoHead(html){
 if(!/<head[\s>]/i.test(html))return html;
 return html.replace(/<head([^>]*)>([\s\S]*?)<\/head>/i,(_,attrs,head)=>'<head'+attrs+'>'+head.replace(/<link\b[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon|manifest)["'][^>]*>/gi,'')+iconTags+'</head>');
}
export async function enrichListing(html,id,env){
 if(!env.DB||!html.includes('class="detail-content"'))return html;
 try{const rows=(await env.DB.prepare("SELECT l.id,l.title,l.city,l.district FROM listings l JOIN users u ON u.id=l.user_id WHERE l.id<>? AND l.status='approved' AND l.member_paused_at IS NULL AND (u.role='admin' OR l.trial_expires_at>unixepoch() OR l.paid_until>unixepoch()) AND LOWER(TRIM(COALESCE(l.service_category,l.category_detail,l.category)))=(SELECT LOWER(TRIM(COALESCE(service_category,category_detail,category))) FROM listings WHERE id=?) AND l.city=(SELECT city FROM listings WHERE id=?) AND NOT EXISTS(SELECT 1 FROM listing_directory d WHERE d.listing_id=l.id AND d.removed_at IS NOT NULL) ORDER BY l.updated_at DESC LIMIT 4").bind(id,id,id).all()).results||[];
 if(!rows.length)return html;
 const cards=rows.map(r=>'<li><a href="/ilan/'+encodeURIComponent(r.id)+'/'+citySlug(r.title).slice(0,80).replace(/-+$/,'')+'/">'+esc(r.title)+'</a><small>'+esc([r.district,r.city].filter(Boolean).join(' / '))+'</small></li>').join('');
 return html.replace('<div class="detail-report">','<section aria-labelledby="related-listings-title" class="prose"><h2 id="related-listings-title">Benzer ilanlar</h2><ul style="padding-left:20px">'+cards+'</ul></section><div class="detail-report">');
 }catch{return html}
}
export function withSeoReview(base,icoBase64){return{...base,async fetch(request,env,ctx){const url=new URL(request.url),path=url.pathname;
 if(['GET','HEAD'].includes(request.method)&&/(?:^|\/)index\.html\/?$/.test(path)){url.pathname=path.replace(/index\.html\/?$/,'');return Response.redirect(url.href,301)}
 if(path==='/favicon.ico'&&['GET','HEAD'].includes(request.method)){const bytes=Uint8Array.from(atob(icoBase64),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':'image/x-icon','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}})}
 const response=await base.fetch(request,env,ctx);if(request.method!=='GET'||response.status!==200||!response.headers.get('content-type')?.includes('text/html'))return response;
 const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');let html=normalizeSeoHead(await response.text());const listing=path.match(/^\/ilan\/([A-Za-z0-9_-]+)\/[^/]+\/$/);if(listing)html=await enrichListing(html,listing[1],env);const guide=localGuides[path];if(guide){const faqs=guide.faqs.map(([q,a])=>'<details><summary>'+esc(q)+'</summary><p>'+esc(a)+'</p></details>').join('');const schema={'@context':'https://schema.org','@type':'FAQPage',mainEntity:guide.faqs.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))};html=html.replace('</main>','<section class="prose" aria-label="Kiralama rehberi"><h2>'+esc(guide.title)+'</h2>'+guide.paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('')+'<h2>Sıkça sorulan sorular</h2>'+faqs+'</section><script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script></main>')}if(path==='/')html=html.replace('</main>','<section class="wrap section prose"><h2>YükVinç ile ekipman ve hizmet ilanlarını keşfedin</h2>'+homeIntroduction.map(p=>'<p>'+esc(p)+'</p>').join('')+'</section></main>');html=normalizePageSeo(html,path);if(!/^\/(?:admin|yonetim|hesabim|giris|ilan-ver|yonetici-kurulum)(?:\/|$)/.test(path)){html=html.replace(/<a\b[^>]*href="\/(?:admin|yonetim)\/"[^>]*>[\s\S]*?<\/a>/gi,'');html=html.replace('</body>',await publicDiscoveryFooter(env)+'</body>')}return new Response(html,{status:response.status,headers});
}}}
