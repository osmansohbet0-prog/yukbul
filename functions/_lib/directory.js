import {resolveLocation} from '../../public/assets/location-tools.js';
import {digest} from './member.js';
export const SOURCES=['owner','map_no_website','low_traffic_website','promotion'];
export const CONTACT_STATUSES=['Bilgilendirilmedi','Bilgilendirildi','Arandı','Kabul etti','Düzeltme istedi','Kaldırma talebi'];
export const SERVICE_LABELS={crane:'vinç',mobile_tire:'mobil lastikçi ve yerinde lastik tamiri',tow:'çekici ve yol yardım',basket:'sepetli platform',machine:'iş makinesi',manlift:'manlift',lift:'nakliyat asansörü',operator:'operatör'};
export const PUBLIC_NOTICE='Firma bilgileri kamuya açık kaynaklardan derlenmiştir. Düzeltme veya kaldırma için iletişime geçin.';
export const PUBLIC_FILTER=alias=>`NOT EXISTS(SELECT 1 FROM listing_directory directory_hidden WHERE directory_hidden.listing_id=${alias}.id AND directory_hidden.removed_at IS NOT NULL)`;
export function cleanDirectory(d,x){
 if(!d||!SOURCES.includes(d.source))throw Error('İlan kaynağını seçin.');
 const loc=resolveLocation(x.city,x.district);if(!loc)throw Error('İl ve ilçe uyuşmuyor; listeden seçin.');
 if(!CONTACT_STATUSES.includes(d.contact_status||'Bilgilendirilmedi'))throw Error('İletişim durumu geçersiz.');
 const email=String(d.contact_email||'').trim().toLowerCase();if(email&&(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||email.length>200))throw Error('Firma e-postasını kontrol edin.');
 const lat=d.latitude==null||d.latitude===''?loc.latitude:Number(d.latitude),lon=d.longitude==null||d.longitude===''?loc.longitude:Number(d.longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<35||lat>43||lon<25||lon>45)throw Error('Türkiye içindeki enlem ve boylamı kontrol edin.');
 if(String(d.contact_note||'').length>1000||String(d.neighborhood||'').length>120)throw Error('Not veya mahalle çok uzun.');
 return{...d,source:d.source,unaware:d.unaware===true||d.unaware===1?1:0,contact_status:d.unaware?'Bilgilendirilmedi':d.contact_status||'Bilgilendirilmedi',contact_email:email||null,contact_note:String(d.contact_note||'').trim(),contact_at:typeof d.contact_at==='number'?d.contact_at:d.contact_at?Math.floor(Date.parse(d.contact_at)/1000):null,neighborhood:String(d.neighborhood||'').trim(),latitude:lat,longitude:lon,location_precision:d.location_verified===true?'admin_verified':'district_center',city:loc.city,district:loc.district};
}
export function basicDirectoryFields(x,d,photos=[],tier='standard'){
 if(d.source==='owner')return x;
 if(tier!=='standard')throw Error('Kamuya açık firma kayıtları öne çıkarılamaz.');
 if(!String(x.business_name||'').trim())throw Error('Firma adı gerekli.');
 return{...x,title:String(x.business_name).trim()+' · '+SERVICE_LABELS[x.category],description:`${x.city} / ${x.district} bölgesinde ${SERVICE_LABELS[x.category]||'ekipman'} hizmeti için firma iletişim kaydı.`,address:'',price_amount:null,price_unit:'arayiniz'};
}
export async function directoryStatements(db,id,d,actor){
 const list=[db.prepare(`INSERT INTO listing_directory(listing_id,source,unaware,contact_status,contact_email,contact_note,contact_at,neighborhood,latitude,longitude,location_precision) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(listing_id) DO UPDATE SET source=excluded.source,unaware=excluded.unaware,contact_status=excluded.contact_status,contact_email=excluded.contact_email,contact_note=excluded.contact_note,contact_at=excluded.contact_at,neighborhood=excluded.neighborhood,latitude=excluded.latitude,longitude=excluded.longitude,location_precision=excluded.location_precision,updated_at=unixepoch()`).bind(id,d.source,d.unaware,d.contact_status,d.contact_email,d.contact_note,Number.isFinite(d.contact_at)?d.contact_at:null,d.neighborhood,d.latitude,d.longitude,d.location_precision)];
 if(d.location_precision==='admin_verified')list.push(db.prepare('INSERT INTO listing_locations(listing_id,latitude,longitude,verified_by) VALUES(?,?,?,?) ON CONFLICT(listing_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,verified_by=excluded.verified_by,updated_at=unixepoch()').bind(id,d.latitude,d.longitude,actor));
 else list.push(db.prepare('DELETE FROM listing_locations WHERE listing_id=?').bind(id));
 return list;
}
export async function identityHashes(x){
 const phone=String(x.contact_phone||'').replace(/\D/g,'').replace(/^90/,'').replace(/^0/,'');const email=String(x.contact_email||'').trim().toLowerCase();
 const fold=v=>String(v||'').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]/g,'');
 const values=[phone?'phone:'+phone:null,email?'email:'+email:null,x.business_name?'firm:'+fold(x.business_name)+'|'+fold(x.city)+'|'+fold(x.district):null].filter(Boolean);return Promise.all(values.map(digest));
}
export async function suppressed(db,x){const hashes=await identityHashes(x);if(!hashes.length)return false;return!!(await db.prepare('SELECT identity_hash FROM outreach_suppression WHERE identity_hash IN ('+hashes.map(()=>'?').join(',')+') LIMIT 1').bind(...hashes).first())}
export function dueInBusinessDays(now=new Date(),days=3){const d=new Date(now);while(days){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)days--}return Math.floor(d.getTime()/1000)}
