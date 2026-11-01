import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {onRequestGet} from '../functions/api/listing-photo/[id].js';
test('photo preview returns only the small image, falls back for old uploads and protects unpublished photos',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE listings(id TEXT,status TEXT,user_id TEXT,member_paused_at INTEGER);CREATE TABLE listing_photos(id TEXT,listing_id TEXT,mime_type TEXT,image_blob BLOB,thumbnail_blob BLOB,thumbnail_mime TEXT);');
 sql.prepare('INSERT INTO listings VALUES(?,?,?,NULL)').run('public','approved','owner');sql.prepare('INSERT INTO listings VALUES(?,?,?,NULL)').run('private','pending','owner');
 const insert=sql.prepare('INSERT INTO listing_photos VALUES(?,?,?,?,?,?)');insert.run('preview','public','image/jpeg',new Uint8Array([1,2,3]),new Uint8Array([4]),'image/webp');insert.run('old','public','image/jpeg',new Uint8Array([5,6,7]),null,null);insert.run('pending','private','image/jpeg',new Uint8Array([8]),null,null);
 const DB={prepare(q){let values=[];return{bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)}}}};
 const get=(id,query='')=>onRequestGet({params:{id},request:new Request('https://yukvinc.com.tr/api/listing-photo/'+id+query),env:{DB}});
 const small=await get('preview','?thumb=1');assert.equal(small.status,200);assert.equal(small.headers.get('content-type'),'image/webp');assert.deepEqual([...new Uint8Array(await small.arrayBuffer())],[4]);
 assert.deepEqual([...new Uint8Array(await (await get('preview')).arrayBuffer())],[1,2,3]);assert.deepEqual([...new Uint8Array(await (await get('old','?thumb=1')).arrayBuffer())],[5,6,7]);assert.equal((await get('pending')).status,404);
 sql.close();
});
