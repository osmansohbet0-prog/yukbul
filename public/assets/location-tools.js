import {PROVINCES} from './turkey-locations.js';
export {PROVINCES};
export const fold=v=>String(v||'').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]+/g,' ').trim();
export function resolveLocation(city,district){const p=PROVINCES.find(x=>fold(x.name)===fold(city));if(!p)return null;const d=p.districts.find(x=>fold(x.name)===fold(district)||(fold(district)===fold(p.name)&&x.name==='Merkez'));return d?{city:p.name,district:d.name,latitude:d.latitude,longitude:d.longitude,precision:'district_center'}:null}
function distance(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old}}return row[b.length]}
export function suggestLocation(text,selectedCity=''){
 const words=' '+fold(text)+' ',mentioned=PROVINCES.filter(p=>words.includes(' '+fold(p.name)+' '));let provinces=mentioned.length?mentioned:PROVINCES.filter(p=>fold(p.name)===fold(selectedCity));
 if(!provinces.length){const tokens=fold(text).split(' ');provinces=PROVINCES.filter(p=>tokens.some(t=>t.length>=4&&distance(t,fold(p.name))<=1))}
 const candidates=[];for(const p of provinces){for(const d of p.districts){const name=fold(d.name),exact=words.includes(' '+name+' '),typo=!exact&&name!=='merkez'&&fold(text).split(' ').some(t=>t.length>=4&&distance(t,name)<=1);if(exact||typo)candidates.push({...resolveLocation(p.name,d.name),corrected:!exact})}}
 const foreign=provinces.length===1?PROVINCES.filter(p=>p.id!==provinces[0].id).flatMap(p=>p.districts.filter(d=>d.name!=='Merkez'&&words.includes(' '+fold(d.name)+' ')).map(d=>p.name+' / '+d.name)):[];
 return{candidates:candidates.slice(0,8),warning:!candidates.length&&foreign.length?'İl ve ilçe uyuşmuyor. İlçe şu ile ait olabilir: '+foreign.slice(0,3).join(', '):null};
}
