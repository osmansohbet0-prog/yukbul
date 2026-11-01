import {contentRevisions} from './_lib/content-revisions.js';
import {categoryPaths,citySlug} from './_lib/discovery.js';
const BASE='https://yukvinc.com.tr', SIZE=50000;
const xml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const indexableListing=r=>Boolean(r.photo_id)||String(r.description||'').trim().split(/\s+/u).filter(Boolean).length>=40;
export async function sitemapInventory(db){
 const rows=[];let cursor='';
 while(true){
  const{results=[]}=await db.prepare("SELECT l.id,l.title,l.description,LOWER(TRIM(COALESCE(NULLIF(TRIM(l.service_category),''),NULLIF(TRIM(l.category_detail),''),TRIM(l.category)))) AS category,l.city,l.updated_at,l.created_at,(SELECT id FROM listing_photos p WHERE p.listing_id=l.id ORDER BY sort_order LIMIT 1) photo_id FROM listings l WHERE l.id>? AND l.status='approved' AND NOT EXISTS(SELECT 1 FROM listing_directory directory_hidden WHERE directory_hidden.listing_id=l.id AND directory_hidden.removed_at IS NOT NULL) AND l.member_paused_at IS NULL AND (LOWER(TRIM(COALESCE(NULLIF(TRIM(l.service_category),''),NULLIF(TRIM(l.category_detail),''),TRIM(l.category))))='operator' OR EXISTS(SELECT 1 FROM users u WHERE u.id=l.user_id AND u.role='admin') OR l.trial_expires_at>unixepoch() OR l.paid_until>unixepoch()) ORDER BY l.id LIMIT 500").bind(cursor).all();
  rows.push(...results);if(results.length<500)break;
  const next=String(results.at(-1).id);if(next<=cursor)throw Error('Pagination did not advance');cursor=next;
 }
 const groups={pages:['/','/iletisim/','/hakkimizda/'].map(path=>({path,lastmod:contentRevisions[path]})),categories:[],cities:[],listings:[],jobs:[]}, cats=new Map(),cities=new Map();
 for(const r of rows){
  const d=new Date(Number(r.updated_at||r.created_at)*1000);if(!Number.isFinite(d.getTime()))continue;const lastmod=d.toISOString(),cat=categoryPaths[String(r.category||'').trim()],city=citySlug(r.city);
  for(const [map,key]of [[cats,cat],[cities,city]])if(key)map.set(key,[map.get(key),lastmod].filter(Boolean).sort().at(-1));
  if(indexableListing(r))groups.listings.push({path:'/ilan/'+encodeURIComponent(r.id)+'/'+(citySlug(r.title).slice(0,80).replace(/-+$/,'')||'ilan')+'/',lastmod,image:r.photo_id?BASE+'/api/listing-photo/'+encodeURIComponent(r.photo_id)+'?v=3':null});
 }
 groups.categories=[...cats].map(([slug,lastmod])=>({path:'/kategori/'+slug+'/',lastmod:[lastmod,contentRevisions['/kategori/'+slug+'/']].filter(Boolean).sort().at(-1)}));groups.cities=[...cities].map(([slug,lastmod])=>({path:'/sehir/'+slug+'/',lastmod:[lastmod,contentRevisions['/sehir/'+slug+'/']].filter(Boolean).sort().at(-1)}));try{const {results:jobs=[]}=await db.prepare("SELECT id,status,updated_at,created_at FROM job_requests WHERE status='open' ORDER BY updated_at DESC").all();
 for(const j of jobs){if(j.status!=='open')continue;const d=new Date(Number(j.updated_at||j.created_at)*1000);if(Number.isFinite(d.getTime()))groups.jobs.push({path:'/is-talepleri/'+encodeURIComponent(j.id)+'/',lastmod:d.toISOString()})}
 if(contentRevisions['/is-talepleri/'])groups.pages.push({path:'/is-talepleri/',lastmod:contentRevisions['/is-talepleri/']});
 }catch{}return groups;
}
export async function onRequestGet({env,request}){
 if(!env.DB)return unavailable();
 try{const groups=await sitemapInventory(env.DB),path=new URL(request?.url||BASE+'/sitemap.xml').pathname;let body;
 if(path==='/sitemap.xml')body='<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+Object.entries(groups).flatMap(([name,rows])=>Array.from({length:Math.ceil(rows.length/SIZE)},(_,i)=>{const chunk=rows.slice(i*SIZE,(i+1)*SIZE);return '<sitemap><loc>'+BASE+'/sitemaps/'+name+'-'+(i+1)+'.xml</loc><lastmod>'+chunk.map(r=>r.lastmod).sort().at(-1)+'</lastmod></sitemap>'})).join('')+'</sitemapindex>';
 else{const match=path.match(/^\/sitemaps\/(pages|categories|cities|listings|jobs)-([1-9]\d*)\.xml$/);if(!match)return new Response('Sitemap bulunamadı.',{status:404});const rows=groups[match[1]].slice((Number(match[2])-1)*SIZE,Number(match[2])*SIZE);if(!rows.length)return new Response('Sitemap bulunamadı.',{status:404});body='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'+rows.map(r=>'<url><loc>'+xml(BASE+r.path)+'</loc><lastmod>'+r.lastmod+'</lastmod>'+(r.image?'<image:image><image:loc>'+xml(r.image)+'</image:loc></image:image>':'')+'</url>').join('')+'</urlset>'}
 return new Response('<?xml version="1.0" encoding="UTF-8"?>'+body,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'no-store'}})
 }catch(e){console.error('[sitemap]',e?.name||'Error');return unavailable()}
}
function unavailable(){return new Response('Sitemap geçici olarak oluşturulamıyor.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','retry-after':'300'}})}
