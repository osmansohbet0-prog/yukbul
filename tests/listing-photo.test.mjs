import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/listing-photo/[id].js';

function context(image_blob){
 const photo={mime_type:'image/webp',image_blob,listing_id:'listing',status:'approved',user_id:'member'};
 const DB={prepare(){return{bind(){return{first:async()=>photo}}}}};
 return {params:{id:'photo'},request:new Request('https://example.test/api/listing-photo/photo'),env:{DB}};
}

test('listing photo route returns the exact bytes from an ArrayBuffer',async()=>{
 const expected=Uint8Array.from([82,73,70,70,1,2,3,4]);
 const response=await onRequestGet(context(expected.buffer));
 assert.equal(response.status,200);
 assert.equal(response.headers.get('content-type'),'image/webp');
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),expected);
});

test('listing photo route respects the byte offset of a D1 binary view',async()=>{
 const expected=Uint8Array.from([82,73,70,70,1,2,3,4]);
 const backing=Uint8Array.from([99,99,...expected,77,77]);
 const response=await onRequestGet(context(backing.subarray(2,2+expected.length)));
 assert.equal(response.status,200);
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),expected);
});
