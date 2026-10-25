// Deterministic evidence only: a risk score never authorizes publication or account sanctions.
const fold=v=>String(v||'').normalize('NFKC').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/\p{Diacritic}/gu,'');
export const DEFAULT_MODERATION={min_samples:5,low_ratio:.4,high_ratio:4,min_price:500,max_price:10000000,capacity_tolerance:.2,flag_score:35,hours_per_day:null,days_per_month:null,references:[]};
export function cleanModeration(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const c={...DEFAULT_MODERATION,...value};
 for(const [k,min,max] of [['min_samples',5,100],['low_ratio',.05,.95],['high_ratio',1.1,20],['min_price',0,1000000],['max_price',1000,1000000000],['capacity_tolerance',0,.5],['flag_score',20,80]])if(!Number.isFinite(c[k])||c[k]<min||c[k]>max)return null;
 if(!Number.isInteger(c.min_samples)||c.min_price>=c.max_price)return null;
 for(const [k,max] of [['hours_per_day',24],['days_per_month',31]])if(c[k]!==null&&(!Number.isFinite(c[k])||c[k]<1||c[k]>max))return null;
 if(!Array.isArray(c.references)||c.references.length>100)return null;
 for(const r of c.references)if(!r||!['crane','tow','basket','machine','lift','manlift','operator'].includes(r.category)||typeof r.city!=='string'||!r.city||r.city.length>80||!unit(r.unit)||!Number.isFinite(r.min)||!Number.isFinite(r.max)||r.min<0||r.max<=r.min||typeof r.subtype!=='string'||r.subtype.length>40||!(r.capacity==null||Number.isFinite(r.capacity)&&r.capacity>0))return null;
 return Object.fromEntries(Object.keys(DEFAULT_MODERATION).map(k=>[k,c[k]]));
}
export async function readModeration(db){
 const row=await db.prepare("SELECT value_json FROM site_settings WHERE setting_key='listing_moderation'").first();
 if(!row)return{...DEFAULT_MODERATION};
 try{return cleanModeration(JSON.parse(row.value_json))||{...DEFAULT_MODERATION}}catch{return{...DEFAULT_MODERATION}}
}
export function unit(v){const s=fold(v);return ({saatlik:'hour',hour:'hour',gunluk:'day',day:'day',aylik:'month',month:'month',sefer:'job','sefer basi':'job','is basi':'job',is_basi:'job',job:'job'})[s]||null}
export function segment(x){
 const t=fold(x.title+' '+x.description);
 const subtype=(t.match(/\b(mobil|kule|sepetli|makasli|eklemli|teleskopik|forklift|paletli|ekskavator|cekici)\b/)||[])[1]||'belirsiz';
 const capacity=t.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(ton|tonluk|tonaj|metre|metrelik|m)(?:\b|$)/);
 return{category:x.category,subtype,capacity:capacity?Number(capacity[1].replace(',','.')):null,capacity_unit:capacity?capacity[2].startsWith('ton')?'ton':'m':null,city:fold(x.city),unit:unit(x.price_unit)};
}
export function quantile(sorted,p){if(!sorted.length)return null;const i=(sorted.length-1)*p,a=Math.floor(i),b=Math.ceil(i);return sorted[a]+(sorted[b]-sorted[a])*(i-a)}
function convert(amount,from,to,c){
 if(from===to)return Number(amount);
 if(!from||!to||from==='job'||to==='job'||!c.hours_per_day)return null;
 const hours={hour:1,day:c.hours_per_day,month:c.days_per_month?c.hours_per_day*c.days_per_month:null};
 return hours[from]&&hours[to]?Number(amount)/hours[from]*hours[to]:null;
}
function compatible(a,b,c){return a.category===b.category&&a.subtype===b.subtype&&a.city===b.city&&a.capacity_unit===b.capacity_unit&&(a.capacity==null?b.capacity==null:b.capacity!=null&&Math.abs(a.capacity-b.capacity)<=a.capacity*c.capacity_tolerance)}
export function comparePrice(item,rows,config=DEFAULT_MODERATION){
 const c={...DEFAULT_MODERATION,...config},s=segment(item),values=[];const seen=new Set();
 for(const row of rows){if(row.id===item.id||!compatible(s,segment(row),c)||row.price_amount==null||Number(row.price_amount)<=0)continue;
  // A single prolific advertiser must not control the market reference.
  const owner=row.user_id||row.id;if(seen.has(owner))continue;
  const value=convert(row.price_amount,unit(row.price_unit),s.unit,c);if(value!=null&&Number.isFinite(value)){values.push(value);seen.add(owner)}
 }
 values.sort((a,b)=>a-b);let source='insufficient',median=null,q1=null,q3=null,min=null,max=null;
 if(values.length>=c.min_samples){source='listings';median=quantile(values,.5);q1=quantile(values,.25);q3=quantile(values,.75);min=Math.max(0,q1-1.5*(q3-q1));max=q3+1.5*(q3-q1)}
 else{const ref=c.references.find(r=>r.category===s.category&&fold(r.city)===s.city&&r.subtype===s.subtype&&(r.capacity==null?s.capacity==null:s.capacity!=null&&Math.abs(r.capacity-s.capacity)<=s.capacity*c.capacity_tolerance)&&unit(r.unit)===s.unit);if(ref){source='admin_reference';min=ref.min;max=ref.max}}
 const amount=item.price_amount==null?null:Number(item.price_amount),outside=amount!=null&&min!=null&&(amount<min||amount>max);
 const fmt=v=>Math.round(v).toLocaleString('tr-TR');
 const warning=source==='listings'?`Benzer ilanların medyanı yaklaşık ${fmt(median)} TL, aralık ${fmt(min)}–${fmt(max)} TL.${outside?' Fiyatın bu aralığın dışında görünüyor, kontrol etmek ister misin?':''}`:source==='admin_reference'?`Yetersiz veri. Yönetici referans aralığı ${fmt(min)}–${fmt(max)} TL.${outside?' Fiyatını kontrol etmek ister misin?':''}`:'Yetersiz veri: güvenilir bir fiyat karşılaştırması için yeterli benzer ilan veya yönetici referansı yok.';
 return{source,count:values.length,required:c.min_samples,median,q1,q3,iqr:q1==null?null:q3-q1,min,max,outside,deviation:median&&amount!=null?(amount-median)/median:null,unit:s.unit,segment:s,warning,conversion_assumptions:c.hours_per_day?{hours_per_day:c.hours_per_day,days_per_month:c.days_per_month}:null};
}
export function assessRisk(item,comparison,account={},config=DEFAULT_MODERATION){
 const c={...DEFAULT_MODERATION,...config},text=fold(item.title+' '+item.description),reasons=[];let score=0;
 const add=(code,points,reason)=>{score+=points;reasons.push({code,points,reason})};
 const price=item.price_amount==null?null:Number(item.price_amount);
 if(item.category!=='operator'&&price!=null&&(price<c.min_price||price>c.max_price))add('price_absolute',40,'Ücret yapılandırılmış güvenli kontrol aralığının dışında.');
 if(comparison.median&&price!=null&&(price<comparison.median*c.low_ratio||price>comparison.median*c.high_ratio))add('price_relative',40,`Segment medyanından sapma: %${Math.round(comparison.deviation*100)}.`);
 if(comparison.source==='admin_reference'&&comparison.outside)add('price_reference',35,'Ücret yönetici referans aralığının dışında.');
 if(/kapora|pesin.{0,25}(odeme|havale)|hemen.{0,25}(gonder|yatir)|once.{0,25}(havale|odeme)/.test(text))add('advance_pressure',35,'Ön ödeme veya havale baskısı olabilecek ifade.');
 if(/sadece.{0,20}(whatsapp|vatsap)/.test(text))add('whatsapp_only',15,'Yalnızca WhatsApp üzerinden iletişim talebi.');
 if(/acil.{0,30}(hemen|bugun)|son firsat|acele et/.test(text))add('urgency',10,'Acele karar verme baskısı.');
 if(/\btr\s*(?:\d\s*){24}\b/i.test(text))add('iban',35,'Açıklamada banka hesap bilgisi var.');
 if(/https?:\/\/|www\.|t\.me\/|wa\.me\//.test(text))add('external_link',20,'İlan açıklamasında dış bağlantı var.');
 const quoted=[...text.matchAll(/(\d[\d.,]*)\s*(?:tl|lira)/g)].map(m=>Number(m[1].replace(/[.,]/g,'')));
 if(price!=null&&quoted.some(v=>v!==price&&v>0))add('price_text_mismatch',20,'Metindeki ücret ile ücret alanı farklı; kapsamı doğrulayın.');
 if(/(?:telefon|numara).{0,15}(gizli|yazmam|vermiyorum)/.test(text))add('hidden_contact',15,'İletişim bilgisini gizleme ifadesi.');
 if(account.age_days!=null&&account.age_days<3)add('new_account',5,'Hesap üç günden yeni; tek başına ret sebebi değildir.');
 if(account.daily_count>=4)add('velocity',15,'Kısa sürede birden fazla ilan.');
 if(account.shared_phone)add('shared_phone',25,'Telefon başka bir hesapta da kullanılıyor.');
 if(account.shared_iban)add('shared_iban',35,'Banka hesap bilgisi başka bir hesapta da kullanılıyor.');
 if(account.duplicate)add('duplicate',40,'Başka bir ilanda benzer fotoğraf veya metin.');
 if(account.location_mismatch)add('location_mismatch',25,'Açıklamadaki konum ile seçilen konum tutarsız olabilir.');
 if(/(?:asdf|qwer|zxcv|lorem ipsum)|(.)\1{8}/.test(text))add('random_text',35,'Başlık veya açıklamada rastgele ya da tekrarlanan metin.');
 return{score:Math.min(100,score),reasons,flagged:score>=c.flag_score,suggested_action:score>=c.flag_score?'Elle incele ve gerekirse düzeltme iste':'Yönetici onayını beklet',needs_text_analysis:score<c.flag_score&&(reasons.length>0||String(item.description||'').trim().split(/\s+/).length<8||comparison.segment?.subtype==='belirsiz')};
}
export async function reviewByRules(db,item,userId){
 const config=await readModeration(db);
 const {results:rows=[]}=await db.prepare("SELECT id,user_id,category,title,description,city,price_amount,price_unit FROM listings WHERE status='approved' AND category=? AND city=? AND id<>? AND (category='operator' OR user_id IN (SELECT id FROM users WHERE role='admin') OR trial_expires_at>unixepoch() OR paid_until>unixepoch()) ORDER BY created_at DESC LIMIT 500").bind(item.category,item.city,item.id||'').all();
 const account=await db.prepare("SELECT (unixepoch()-created_at)/86400.0 AS age_days,(SELECT COUNT(*) FROM listings WHERE user_id=users.id AND created_at>unixepoch()-86400) AS daily_count FROM users WHERE id=?").bind(userId).first()||{};
 const shared=await db.prepare("SELECT id FROM listings WHERE user_id<>? AND replace(replace(replace(replace(contact_phone,' ',''),'-',''),'(',''),')','')=? AND status<>'deleted' LIMIT 1").bind(userId,String(item.contact_phone||'').replace(/[ ()-]/g,'')).first();account.shared_phone=!!shared;
 const text=fold(item.title+' '+item.description);const locationMentions=[...text.matchAll(/(?:hizmet bolgesi|adres|konum)\s*[:=]\s*([a-z]+)\s*\//g)].map(m=>m[1]);account.location_mismatch=locationMentions.some(city=>city!==fold(item.city));
 const iban=(text.match(/\btr\s*(?:\d\s*){24}\b/i)||[])[0]?.replace(/\s/g,'');if(iban){const peer=await db.prepare("SELECT id FROM listings WHERE user_id<>? AND lower(replace(description,' ','')) LIKE ? AND status<>'deleted' LIMIT 1").bind(userId,'%'+iban+'%').first();account.shared_iban=!!peer}
 const comparison=comparePrice(item,rows,config),risk=assessRisk(item,comparison,account,config);
 return{comparison,...risk};
}
export async function saveRuleReview(db,id,result){
 await db.prepare('INSERT INTO listing_reviews(listing_id,risk_score,evidence_json,created_at) VALUES(?,?,?,unixepoch()) ON CONFLICT(listing_id) DO UPDATE SET risk_score=excluded.risk_score,evidence_json=excluded.evidence_json,created_at=excluded.created_at').bind(id,result.score,JSON.stringify(result)).run();
}
export function maskEmail(v){const [name,host]=String(v||'').split('@');return host?name.slice(0,1)+'***@'+host:'—'}
export function maskPhone(v){const n=String(v||'').replace(/\D/g,'');return n?n.slice(0,2)+'******'+n.slice(-2):'—'}
