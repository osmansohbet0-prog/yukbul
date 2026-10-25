import {readBoundedText} from './core.js';
export const GMAIL_SCOPES=['https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/gmail.readonly'];
export function gmailConfigured(env){return Boolean(env.OUTREACH_GMAIL_ADDRESS&&env.OUTREACH_GMAIL_CLIENT_ID&&env.OUTREACH_GMAIL_CLIENT_SECRET&&env.OUTREACH_GMAIL_REFRESH_TOKEN)&&String(env.OUTREACH_GMAIL_ADDRESS).toLowerCase()!==String(env.ADMIN_EMAIL||'').toLowerCase()}
export async function googleJson(url,options={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});const raw=await readBoundedText(response,2_000_000);if(!response.ok)throw Error('Gmail işlemi tamamlanamadı ('+response.status+').');return JSON.parse(raw);
}
export async function gmailClient(env){
 if(!gmailConfigured(env))throw Error('Ayrı Gmail hesabı ve OAuth secret ayarları tamamlanmalı. Kişisel yönetici hesabı kullanılamaz.');
 const t=await googleJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.OUTREACH_GMAIL_CLIENT_ID,client_secret:env.OUTREACH_GMAIL_CLIENT_SECRET,refresh_token:env.OUTREACH_GMAIL_REFRESH_TOKEN,grant_type:'refresh_token'})});
 if(!t.access_token)throw Error('Gmail yetkisi alınamadı.');
 const call=(path,options={})=>googleJson('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{...options,headers:{authorization:'Bearer '+t.access_token,'content-type':'application/json',...(options.headers||{})}});
 const profile=await call('profile');if(String(profile.emailAddress).toLowerCase()!==String(env.OUTREACH_GMAIL_ADDRESS).toLowerCase())throw Error('OAuth hesabı gönderici hesabıyla eşleşmiyor.');
 return call;
}
export function encodeB64(text){const bytes=new TextEncoder().encode(text);let raw='';for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export function decodeB64(value){try{const raw=atob(String(value||'').replace(/-/g,'+').replace(/_/g,'/'));return new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0)))}catch{return''}}
export function replyCommand(payload){
 let plain='';function walk(part){if(part.mimeType==='text/plain'&&part.body?.data&&!plain)plain=decodeB64(part.body.data);for(const child of part.parts||[])walk(child)}walk(payload||{});
 const line=plain.trim().split(/\r?\n/)[0]?.trim().toLocaleUpperCase('tr');return /^(RET|KALDIR|DÜZELT|DUZELT)[.!]?\s*$/.test(line)?line.replace(/[.!]/g,'').replace('DÜZELT','DUZELT'):null;
}
export async function sendGmail(call,from,to,body,draftId){
 if(!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(to)||!/^[-a-zA-Z0-9._+]+@gmail\.com$/.test(from))throw Error('Gmail gönderici/alıcı adresi geçersiz.');
 const title64=encodeB64('YükVinç firma kaydınız hakkında').replace(/-/g,'+').replace(/_/g,'/');
 const subject='=?UTF-8?B?'+title64+'='.repeat((4-title64.length%4)%4)+'?=';
 const encoded=encodeB64(body).replace(/-/g,'+').replace(/_/g,'/');const padded=encoded+'='.repeat((4-encoded.length%4)%4);
 const mail=`From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMessage-ID: <${draftId}@yukvinc.com.tr>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${padded.match(/.{1,76}/g).join('\r\n')}`;
 return call('messages/send',{method:'POST',body:JSON.stringify({raw:encodeB64(mail)})});
}
