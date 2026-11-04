import {plainSourceText} from './text.js';
import {PROVINCES} from '../public/assets/turkey-locations.js';
const fold=s=>String(s||'').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'');

export function labUrl(value,base){
 try{const u=new URL(value,base);if(u.protocol!=='https:'||u.port||u.username||u.password||!/(?:\.edu\.tr|\.gov\.tr)$/.test(u.hostname))return null;u.hash='';return u.toString();}catch{return null;}
}
function contentHtml(html){return String(html).replace(/<(nav|footer|aside|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ');}
function jobSchemas(html){
 const jobs=[];function visit(o,depth=0){if(depth>8||!o||typeof o!=='object')return;if(Array.isArray(o)){o.slice(0,50).forEach(x=>visit(x,depth+1));return;}if([o['@type']].flat().includes('JobPosting'))jobs.push(o);if(o['@graph'])visit(o['@graph'],depth+1);}
 for(const m of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{visit(JSON.parse(m[1]));}catch{}
 return jobs.slice(0,8);
}
function epoch(value,endOfDay=false){
 const s=String(value||'').trim();let ms;
 if(/^20\d{2}-\d{2}-\d{2}$/.test(s))ms=Date.parse(s+(endOfDay?'T23:59:59+03:00':'T00:00:00+03:00'));
 else if(/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(s))ms=Date.parse(s);
 else return null;
 return Number.isFinite(ms)?Math.floor(ms/1000):null;
}
export function labDeadline(text){
 const f=fold(text),out=[];
 const months=['ocak','subat','mart','nisan','mayis','haziran','temmuz','agustos','eylul','ekim','kasim','aralik'];
 const re=/son\s+basvuru(?:\s+(?:tarihi|gunu|saati))?\s*[:\-–]?\s*(\d{1,2})[.\/\s-]+(\d{1,2}|ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)[.\/\s-]+(20\d{2})(?:\s*(?:saat\s*:?\s*)?(\d{1,2})[:.](\d{2}))?/g;
 for(const m of f.matchAll(re)){
  const month=/^\d+$/.test(m[2])?Number(m[2]):months.indexOf(m[2])+1;
  const day=Number(m[1]),hour=m[4]===undefined?23:Number(m[4]),minute=m[5]===undefined?59:Number(m[5]);
  if(month<1||month>12||day<1||day>31||hour>23||minute>59)continue;
  const date=`${m[3]}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  if(new Date(date+'T00:00:00Z').getUTCDate()!==day)continue;
  const at=Date.parse(date+`T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:`+(m[4]===undefined?'59':'00')+'+03:00');
  if(Number.isFinite(at))out.push({at:Math.floor(at/1000),evidence:plainSourceText(text).slice(m.index,m.index+m[0].length)});
 }
 const unique=[...new Set(out.map(x=>x.at))];return unique.length===1?out[0]:null;
}
export function analyzeLabJob(html,{url='',title='',now=Math.floor(Date.now()/1000)}={}){
 const schemas=jobSchemas(html); // Multiple jobs on one page cannot be attributed safely.
 const schema=schemas.length===1?schemas[0]:null;
 const clean=contentHtml(html),h1=plainSourceText(clean.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
 const heading=h1||plainSourceText(schema?.title)||title;
 const text=plainSourceText(clean+' '+(schema?.description||'')),f=fold(heading+' '+text),head=fold(heading);
 const roleMatch=f.match(/(?:tibbi\s+laboratuvar\s+(?:teknikeri|teknisyeni|teknikleri)|laboratuvar\s+(?:teknikeri|teknisyeni)|laborant)/);
 const medical=/tibbi|hastane|saglik|klinik|biyokimya|mikrobiyoloji|patoloji|osgb/.test(f);
 const excluded=/yedek\s+aday|yerlesmeye\s+hak|nihai\s+sonuc|alim\s+sonuc|sinav\s+sonuc|iptal|duzeltme|akademik|ogretim\s+(?:uyesi|gorevlisi)|genel\s+basvuru|cv\s+(?:birak|havuz)/.test(head)||/basvurular\s+(?:kapanmistir|sona\s+ermistir)|ilan\s+(?:kapanmistir|iptal\s+edilmistir)/.test(f);
 const procurement=/malzeme\s+alimi|cihaz\s+alimi|sarf\s+malzeme|ihale|hizmet\s+alimi/.test(head);
 const recruiting=/personel\s+alim|sozlesmeli\s+personel|is\s+ilani|aranmaktadir|alinacaktir|istihdam\s+edil|basvuru/.test(head+' '+f.slice(0,5000));
 let status='unverified',reason='Son başvuru ve ilan açıklığı doğrulanamadı.';
 if(!roleMatch||!medical||excluded||procurement||!recruiting){status='not_relevant';reason='Tıbbi laboratuvar personel alımı değil veya sonuç/genel başvuru duyurusu.';}
 const dates=[labDeadline(text)?.at,epoch(schema?.validThrough,true)].filter(Boolean),distinct=[...new Set(dates)];
 const deadline=distinct.length===1?distinct[0]:null;
 const publishedAt=epoch(schema?.datePosted)||null;
 if(status!=='not_relevant'){
  if(schemas.length>1||distinct.length>1)reason='Birden fazla ilan veya çelişen son başvuru tarihi var.';
  else if(deadline&&deadline<=now){status='closed';reason='Son başvuru tarihi geçti.';}
  else if(deadline&&(!publishedAt||publishedAt<=now)&&deadline<=now+180*86400){status='open';reason='İlan metnindeki açık son başvuru tarihi henüz geçmedi.';}
  else if(publishedAt&&publishedAt>now)reason='İlanın başlangıç tarihi henüz gelmedi.';
 }
 const cities=PROVINCES.filter(p=>new RegExp('(?:^|[^a-z])'+fold(p.name)+'(?:$|[^a-z])').test(f));
 const evidence=text.match(/[^.!?]{0,120}(?:laboratuvar|laborant)[^.!?]{0,160}/gi)?.slice(0,3).map(x=>x.trim())||[];
 return {title:heading.slice(0,240),source_url:labUrl(url),organization:plainSourceText(schema?.hiringOrganization?.name||'').slice(0,140),city:cities.length===1?cities[0].name:'',role:roleMatch?.[0]||'',published_at:publishedAt,deadline,status,reason,evidence};
}
