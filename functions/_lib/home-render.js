const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=s=>String(s||'').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80).replace(/-+$/g,'')||'ilan';
export async function renderHome(response,env){
 if(response.status!==200||!env.DB)return response;
 try{
 const {results=[]}=await env.DB.prepare("SELECT l.id,l.title,l.city,l.district,l.description,l.price_amount,l.price_unit,l.package_tier,(SELECT id FROM listing_photos p WHERE p.listing_id=l.id ORDER BY sort_order LIMIT 1) photo_id FROM listings l WHERE l.status='approved' AND (COALESCE(l.category_detail,l.category)='operator' OR EXISTS(SELECT 1 FROM users u WHERE u.id=l.user_id AND u.role='admin') OR l.trial_expires_at>unixepoch() OR l.paid_until>unixepoch()) ORDER BY CASE l.package_tier WHEN 'premium' THEN 2 WHEN 'featured' THEN 1 ELSE 0 END DESC,l.updated_at DESC LIMIT 24").all();
 const cards=results.map(x=>{
 const href='/ilan/'+encodeURIComponent(x.id)+'/'+slug(x.title)+'/';
 const image=x.photo_id?'<img src="/api/listing-photo/'+encodeURIComponent(x.photo_id)+'?v=2" alt="'+esc(x.title)+' ilan fotoğrafı" loading="lazy" decoding="async">':'<span>Fotoğraf eklenmemiş</span>';
 const price=x.price_amount==null?'Ücret için iletişime geç':new Intl.NumberFormat('tr-TR').format(x.price_amount)+' ₺'+(x.price_unit?' / '+esc(x.price_unit==='sefer'?'iş başı':x.price_unit):'');
 return '<article class="listing-card seo-listing-card '+(x.package_tier==='premium'?'premium-card':'')+'"><a class="card-art seo-listing-photo" href="'+href+'">'+image+'</a><div class="card-body">'+(x.package_tier==='premium'?'<span class="featured-badge">Premium · Öne Çıkan</span>':'')+'<h2><a href="'+href+'">'+esc(x.title)+'</a></h2><p class="description">'+esc(x.description).slice(0,260)+'</p><p class="place">'+esc(x.city)+' · '+esc(x.district)+'</p><strong class="price">'+price+'</strong></div></article>';
 }).join('');
 return new HTMLRewriter().on('#result-count',{element(el){el.setInnerContent(results.length+(results.length===24?'+':'')+' ilan')}}).on('#listing-grid',{element(el){el.setInnerContent(cards,{html:true})}}).transform(response);
 }catch(error){console.error('[home-render]',error?.name||'Error');return response}
}
