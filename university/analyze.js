import {plainSourceText} from './text.js';
import {labDeadline} from './legacy-analysis.js';
export const fold=s=>String(s||'').toLocaleLowerCase('tr').replaceAll('ı','i').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function officialUrl(raw,base){
 try{const u=new URL(raw,base);if(u.protocol!=='https:'||u.port||u.username||u.password||(!/(?:\.edu\.tr|\.gov\.tr)$/.test(u.hostname)&&!/(?:^|\.)sabanciuniv\.edu$/.test(u.hostname)))return null;u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^fbclid$/.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;}catch{return null;}
}
export const sameUniversity=(a,b)=>{const root=new URL(b).hostname.replace(/^www\./,'');const h=new URL(a).hostname;return h===root||h.endsWith('.'+root);};
export function candidateLinks(body,base,homepage=base){
 const out=[];const add=(raw,label)=>{const url=officialUrl(raw?.replaceAll('&amp;','&'),base),title=plainSourceText(label),f=fold(title);if(!url||url===base||!sameUniversity(url,homepage)||!/(?:personel|sozlesmeli|4\s*[/ -]?b|kpss|laboratuvar)/.test(f)||!/(?:alim|ilan|basvuru|sozlesmeli)/.test(f)||out.some(x=>x.url===url))return;out.push({url,title:title.slice(0,300)});};
 if(/<(?:rss|feed)\b/i.test(body))for(const m of body.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)){const b=m[2];add(b.match(/<link\b[^>]*href=["']([^"']+)/i)?.[1]||b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1],b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);}
 else for(const m of body.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))add(m[1],m[2]);
 return out.slice(0,80);
}
export function analyzeNotice(html,{title='',now=Math.floor(Date.now()/1000)}={}){
 const body=String(html).replace(/<(script|style|nav|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi,' ');
 const heading=plainSourceText(body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])||title;
 const text=plainSourceText(body),f=fold(text),head=fold(heading);
 const labor=/tibbi\s+laboratuvar\s+(?:tekniker|teknik(?:leri)?\b)|saglik\s+teknikeri\s*\(?\s*tibbi\s+laboratuvar/.test(f);
 const fourB=/4\s*[\/(-]\s*b\b|657.{0,120}4.{0,40}\(b\)|sozlesmeli\s+personel/.test(f);
 const years=[...new Set([...f.matchAll(/\b(20\d{2})\s*(?:yili(?:nda)?\s*)?(?:[-–/()]\s*)?kpss|kpss\s*(?:[-–/()]\s*)?(20\d{2})\b/g)].map(m=>Number(m[1]||m[2])))].sort();
 const types=[...new Set([...f.matchAll(/\bp\s*(93|94|3)\b/g)].map(m=>'P'+m[1]))].sort();
 // A multi-position announcement does not prove the laboratory row requires P93.
 const clauses=f.split(/(?<=[.;])\s+|\n/).filter(x=>/laboratuvar/.test(x));
 const labP93=clauses.some(x=>x.length<=650&&/laboratuvar/.test(x)&&/\bp\s*93\b/.test(x)&&/2026\s*(?:yili\s*)?kpss|kpss\s*[-–/()]?\s*2026/.test(x));
 const noRequirement=/kpss.{0,45}(?:sarti\s+aranma|aranmayacak|sarti\s+yok|istenme)/.test(f);
 const kpssTag=noRequirement?'not_required':years.length>1?'mixed':years[0]===2024?'kpss_2024':years[0]===2026?(types.includes('P93')&&(!labor||labP93)?'kpss_2026_p93':'kpss_2026_unconfirmed_score'):years.length?'other_year':'unknown';
 const deadline=labDeadline(text)?.at||null;
 const startText=f.match(/basvuru(?:larin)?\s+baslangic(?:\s+tarihi)?\s*[:\-–]?\s*\d{1,2}[.\/\s-]+(?:\d{1,2}|ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)[.\/\s-]+20\d{2}/)?.[0];
 const starts=startText?labDeadline(startText.replace(/^basvuru(?:larin)?\s+baslangic(?:\s+tarihi)?/,'son basvuru tarihi'))?.at-86399:null;
 const dates=[...String(html).matchAll(/(?:"datePosted"\s*:\s*"|(?:property|name)=["'](?:article:published_time|datePublished)["'][^>]*content=["'])(20\d{2}-\d{2}-\d{2}(?:T[^"'\s<>]+)?)/gi)].map(m=>m[1]);
 const posted=[...new Set(dates)].map(s=>Date.parse(s.length===10?s+'T00:00:00+03:00':s)).filter(Number.isFinite);
 const published=posted.length===1?Math.floor(posted[0]/1000):null;
 let status='unverified',reason='Başvuru tarihi veya pozisyon şartları elle doğrulanmalı.';
 if(/sonuc|yedek|yerlestirme|hak\s+kazanan|iptal|duzeltme|akademik|ogretim\s+(uyesi|gorevlisi)/.test(head)){status=/iptal/.test(head)?'withdrawn':'result';reason='Yeni başvuru ilanı değil; sonuç, yedek, düzeltme veya iptal duyurusu.';}
 else if(!fourB||/ihale|hizmet\s+alimi|cihaz\s+alimi/.test(head)){status='not_relevant';reason='4/B sözleşmeli personel alımı metinde doğrulanamadı.';}
 else if(deadline&&deadline<=now){status='closed';reason='Son başvuru tarihi geçti.';}
 else if(deadline&&deadline<=now+180*86400){status='open';reason='Resmî sayfada son başvuru tarihi doğrulandı; pozisyon koşulları ayrıca kontrol edilmeli.';}
 if(status==='open'&&published>now){status='unverified';reason='Yayın tarihi gelecekte; başvurunun başladığı doğrulanmadı.';}
 if(status==='open'&&starts>now){status='unverified';reason='Başvuru başlangıç tarihi henüz gelmedi.';}
 if(/basvurular\s+(?:sona\s+ermistir|kapanmistir)|ilan\s+iptal\s+edilmistir/.test(f)){status='withdrawn';reason='Metinde kapanış veya iptal ifadesi var.';}
 const evidence=[...text.matchAll(/[^.;]{0,80}(?:KPSS|P93|P\s*93|laboratuvar|son başvuru)[^.;]{0,180}/gi)].slice(0,8).map(m=>m[0]);
 return {title:heading.slice(0,300),role_tag:labor?'medical_laboratory':fourB?'other_4b':'other_personnel_unconfirmed',kpss_tag:kpssTag,kpss_years:years,score_types:types,status,deadline,starts_at:Number.isFinite(starts)?starts:null,published_at:published,evidence,reason};
}
