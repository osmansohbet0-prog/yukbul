import {fail,currentMember} from '../../_lib/member.js';
import {currentAdmin} from '../../_lib/core.js';
export async function onRequestGet({params,request,env}){
 if(!env.DB)return fail('D1 bağlantısı bulunamadı.',503);
 try{
  const id=String(params.id||''),small=new URL(request.url).searchParams.get('thumb')==='1'?1:0;
  // Return one binary column. A preview request must not also transfer the full
  // photograph from D1; older uploads without previews fall back to the original.
  const photo=await env.DB.prepare(`SELECT CASE WHEN ?=1 AND p.thumbnail_blob IS NOT NULL THEN p.thumbnail_blob ELSE p.image_blob END image_blob,CASE WHEN ?=1 AND p.thumbnail_blob IS NOT NULL THEN COALESCE(p.thumbnail_mime,p.mime_type) ELSE p.mime_type END mime_type,p.listing_id,l.status,l.user_id,l.member_paused_at FROM listing_photos p JOIN listings l ON l.id=p.listing_id WHERE p.id=?`).bind(small,small,id).first();
  if(!photo||photo.status==='deleted')return fail('Fotoğraf bulunamadı.',404);
  if(photo.status!=='approved'||photo.member_paused_at){const user=await currentMember(request,env),admin=await currentAdmin(request,env);if(user?.id!==photo.user_id&&!admin)return fail('Fotoğraf bulunamadı.',404)}
  const raw=photo.image_blob,bytes=raw instanceof ArrayBuffer?new Uint8Array(raw):ArrayBuffer.isView(raw)?new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength):Array.isArray(raw)?Uint8Array.from(raw):null;
  if(!bytes?.byteLength)return fail('Fotoğraf verisi okunamadı.',503);
  return new Response(bytes.slice().buffer,{headers:{'content-type':photo.mime_type,'cache-control':photo.status==='approved'&&!photo.member_paused_at?'public, max-age=3600':'private, no-store','vary':'Cookie','x-content-type-options':'nosniff','content-disposition':'inline'}});
 }catch{return fail('Fotoğraf yüklenemedi.',503)}
}
