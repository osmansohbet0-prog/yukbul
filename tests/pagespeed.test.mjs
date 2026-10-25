import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sqliteD1} from './fixtures/sqlite-d1.mjs';
import {savePhotos,replacePhotos,validatePhotoPayloads} from '../functions/_lib/listings.js';
import {onRequestGet as photoGet} from '../functions/api/listing-photo/[id].js';
import {siteStyles,analyticsStyles} from '../functions/_lib/public-styles.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
test('bundled public styles match their editable sources',()=>{
 assert.equal(siteStyles,read('public/assets/site.css').toString().replace(/\r\n/g,'\n'));
 assert.equal(analyticsStyles,read('public/assets/analytics.css').toString().replace(/\r\n/g,'\n'));
 assert.ok(read('public/assets/yuk-vinc-logo-small.webp').length<3000);
});
test('thumbnail copies preserve originals, replace atomically and enforce visibility',async()=>{
 const db=sqliteD1();try{
 db.sqlite.exec("INSERT INTO users(id,email,email_norm,role) VALUES('admin1','admin@example.test','admin@example.test','admin'); INSERT INTO listings(id,user_id,listing_type,category,title,description,city,district,status) VALUES('listing1','admin1','equipment','crane','Test vinç ilanı','Konya bölgesinde vinç hizmeti','Konya','Meram','approved')");
 const original=read('public/assets/yuk-vinc-logo-192.png'),thumb=read('public/assets/yuk-vinc-logo-small.webp');
 const payload={mime_type:'image/png',data:original.toString('base64'),thumbnail:{mime_type:'image/webp',data:thumb.toString('base64')}};
 assert.equal(validatePhotoPayloads([payload]),true);
 await savePhotos(db,'listing1',[payload]);
 let id=db.sqlite.prepare('SELECT id FROM listing_photos').get().id;
 const get=(small=true)=>photoGet({env:{DB:db},params:{id},request:new Request('https://yukvinc.com.tr/api/listing-photo/'+id+(small?'?thumb=1':''))});
 let r=await get();assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');assert.deepEqual(Buffer.from(await r.arrayBuffer()),thumb);
 r=await get(false);assert.deepEqual(Buffer.from(await r.arrayBuffer()),original);
 db.sqlite.exec("UPDATE listings SET status='pending'");r=await get();assert.equal(r.status,404);assert.doesNotMatch(r.headers.get('cache-control')||'',/public/);
 db.sqlite.exec("UPDATE listings SET status='approved'");await replacePhotos(db,'listing1',[{mime_type:'image/png',data:original.toString('base64')}]);
 assert.equal(db.sqlite.prepare('SELECT count(*) n FROM listing_photos').get().n,1);id=db.sqlite.prepare('SELECT id FROM listing_photos').get().id;
 r=await get();assert.equal(r.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await r.arrayBuffer()),original);
 assert.throws(()=>validatePhotoPayloads([{...payload,thumbnail:{mime_type:'image/svg+xml',data:'abcd'}}]));
 assert.throws(()=>validatePhotoPayloads([{...payload,thumbnail:{mime_type:'image/webp',data:'broken'}}]));
 }finally{db.sqlite.close()}
});
test('listing cards use semantic headings, thumbnails and early first-image priority',()=>{
 const js=read('public/assets/site.js').toString();assert.match(js,/function card\(x,index=0\)/);assert.match(js,/thumb=1/);assert.match(js,/<h2><a/);assert.match(js,/fetchpriority=/);
 for(const path of ['functions/_lib/home-render.js','functions/kategori/[slug].js','functions/sehir/[slug].js']){
  const source=read(path).toString();assert.match(source,/thumb=1/);assert.match(source,/index===0\?'eager':'lazy'/);
 }
});
