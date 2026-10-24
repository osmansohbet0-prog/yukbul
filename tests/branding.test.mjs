import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('Google brand metadata, crawlable PNG icons and CSP agree',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const schemaText=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
 const schema=JSON.parse(schemaText);
 for(const entity of schema['@graph']){assert.equal(entity.name,'Yük Vinç');assert.ok(entity.alternateName.includes('YükVinç'))}
 assert.doesNotMatch(html,/YükBul/);
 assert.match(html,/<title>YükVinç \|/);
 assert.equal((html.match(/rel="icon"/g)||[]).length,1);
 const worker=await readFile(new URL('../src/worker.js',import.meta.url),'utf8'),headers=await readFile(new URL('../public/_headers',import.meta.url),'utf8');
 const hash=createHash('sha256').update(schemaText).digest('base64');
 assert.ok(worker.includes("sha256-"+hash));assert.ok(headers.includes("sha256-"+hash));
 for(const [file,size]of [['yuk-vinc-favicon.png',96],['yuk-vinc-logo-192.png',192],['yuk-vinc-logo-512.png',512]]){
  const png=await readFile(new URL('../public/assets/'+file,import.meta.url));
  assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
 }
});
