import test from 'node:test';
import assert from 'node:assert/strict';
import {publicItems} from '../functions/_lib/listings.js';

function fakeDb(rows=[]){
  const calls=[];
  return{
    calls,
    prepare(sql){
      return{bind(...args){calls.push({sql,args});return{all:async()=>({results:rows})}}};
    },
  };
}

test('publicItems caps page size and orders by newest with stable id tie-break',async()=>{
  const db=fakeDb([{id:'listing_01',package_tier:'standard',created_at:200,price_amount:'1200',photo_id:'photo_01'}]);
  const items=await publicItems(db,{limit:1000,sort:'newest'});
  assert.match(db.calls[0].sql,/ORDER BY 0 DESC,l\.created_at DESC,l\.id DESC LIMIT \?/);
  assert.equal(db.calls[0].args.at(-1),100);
  assert.equal(items[0].price_amount,1200);
  assert.equal(items[0].photo_url,'/api/listing-photo/photo_01?v=2');
});

test('publicItems binds a cursor after applying category filters',async()=>{
  const db=fakeDb([]);
  await publicItems(db,{
    category:'crane',city:'Konya',query:'vinç',limit:21,sort:'newest',
    cursor:{tier:0,created_at:12345,id:'listing_01'},
  });
  const {sql,args}=db.calls[0];
  assert.match(sql,/COALESCE\(l\.service_category,l\.category_detail,l\.category\)=\?/);
  assert.match(sql,/0<\? OR \(0=\? AND \(l\.created_at<\? OR \(l\.created_at=\? AND l\.id<\?\)\)\)/);
  assert.deepEqual(args.slice(-6),[0,0,12345,12345,'listing_01',21]);
});
