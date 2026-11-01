import {escapeHtml as esc,categoryPaths,categoryNames,citySlug} from './discovery.js';
const BASE='https://yukvinc.com.tr';
export function limitText(value,max){const t=String(value||'').replace(/\s+/g,' ').trim();if(t.length<=max)return t;const part=t.slice(0,max-1),at=part.lastIndexOf(' ');return (at>max*.6?part.slice(0,at):part)+'…'}
const decode=v=>String(v||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const plain=v=>decode(String(v||'').replace(/<[^>]*>/g,'')).trim();
export function normalizePageSeo(html,path){
 const canonical=BASE+(path==='/'?'/':path.replace(/\/+$/,'')+'/');
 const oldTitle=plain(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'YükVinç');
 const rawTitle=path==='/'?'Vinç Kiralama Konya ve Kocaeli | YükVinç':oldTitle;
 const suffix=' | YükVinç',title=rawTitle.length<=60?rawTitle:limitText(rawTitle.replace(/\s*\|\s*YükVinç$/,''),60-suffix.length)+suffix;
 const desc=limitText(decode(html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]||plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])+' sayfasındaki YükVinç ilanlarını ve hizmet bilgilerini inceleyin.'),155);
 html=html.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\b[^>]*(?:name="description"|property="og:(?:title|description|url|type|image)")[^>]*>/gi,'').replace(/<link\b[^>]*rel="canonical"[^>]*>/gi,'');
 let h1=0;html=html.replace(/<h1(\b[^>]*)>([\s\S]*?)<\/h1>/gi,(_,a,t)=>++h1===1?'<h1'+a+'>'+t+'</h1>':'<h2'+a+'>'+t+'</h2>');
 if(!h1)html=html.replace(/<main\b[^>]*>/i,m=>m+'<h1>'+esc(rawTitle.replace(suffix,''))+'</h1>');
 const schemas=[];
 html=html.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,(whole,json)=>{try{const data=JSON.parse(json);schemas.push(...(data['@graph']||[data]).filter(x=>!['Organization','WebSite'].includes(x['@type'])));return ''}catch{return whole}});
 schemas.push({'@type':'Organization','@id':BASE+'/#organization',name:'YükVinç',url:BASE+'/',logo:BASE+'/assets/yuk-vinc-logo-192.png',sameAs:['https://www.youtube.com/channel/UCNZdS_n3E7sdVSXsO8cqefA','https://www.instagram.com/yukvinc/','https://www.tiktok.com/@yuk.vinc']},{'@type':'WebSite','@id':BASE+'/#website',name:'YükVinç',url:BASE+'/',inLanguage:'tr-TR',publisher:{'@id':BASE+'/#organization'}});
 if(path!=='/'&&!schemas.some(x=>x['@type']==='BreadcrumbList'))schemas.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Ana sayfa',item:BASE+'/'},{'@type':'ListItem',position:2,name:plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])||title,item:canonical}]});
 const image=decode(html.match(/<img\b[^>]*src="([^"]+)"/i)?.[1]||'/assets/yuk-vinc-logo-512.png');
 const imageUrl=/^https:\/\/yukvinc\.com\.tr\//.test(image)?image:image.startsWith('/')?BASE+image:BASE+'/assets/yuk-vinc-logo-512.png';
 const head='<title>'+esc(title)+'</title><meta name="description" content="'+esc(desc)+'"><link rel="canonical" href="'+esc(canonical)+'"><meta property="og:type" content="website"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(desc)+'"><meta property="og:url" content="'+esc(canonical)+'"><meta property="og:image" content="'+esc(imageUrl)+'"><script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':schemas}).replace(/</g,'\\u003c')+'</script>';
 html=html.replace('</head>',head+'</head>');
 if(path!=='/'&&!/aria-label="(?:Gezinti|Sayfa yolu)"/.test(html))html=html.replace(/<main\b[^>]*>/i,m=>m+'<nav class="detail-breadcrumb" aria-label="Sayfa yolu"><a href="/">Ana sayfa</a><span>›</span><span>'+esc(title.replace(suffix,''))+'</span></nav>');
 return html;
}
export async function publicDiscoveryFooter(env){
 if(!env.DB)return '';
 try{const {results=[]}=await env.DB.prepare("SELECT l.city,LOWER(TRIM(COALESCE(NULLIF(TRIM(l.service_category),''),NULLIF(TRIM(l.category_detail),''),l.category))) AS category FROM listings l WHERE l.status='approved' AND l.member_paused_at IS NULL AND NOT EXISTS(SELECT 1 FROM listing_directory d WHERE d.listing_id=l.id AND d.removed_at IS NOT NULL) AND (l.category='operator' OR EXISTS(SELECT 1 FROM users u WHERE u.id=l.user_id AND u.role='admin') OR l.trial_expires_at>unixepoch() OR l.paid_until>unixepoch()) GROUP BY l.city,category").all();
 const cities=new Map(results.filter(r=>r.city).map(r=>[citySlug(r.city),r.city.trim()])),cats=new Set(results.map(r=>r.category).filter(c=>categoryPaths[c]));
 if(!cities.size&&!cats.size)return '';
 return '<footer class="yv-social-footer"><nav class="wrap" aria-label="Şehir ve kategori ilanları">'+[...cities].map(([slug,name])=>'<a href="/sehir/'+slug+'/">'+esc(name)+' ilanları</a>').concat([...cats].map(c=>'<a href="/kategori/'+categoryPaths[c]+'/">'+esc(categoryNames[c])+' ilanları</a>')).join(' · ')+'</nav></footer>';
 }catch{return ''}
}
