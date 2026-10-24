import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPackageTier,tierRank,tierLabel} from '../functions/_lib/package-tiers.js';
import {publicItems} from '../functions/_lib/listings.js';

test('only three admin package levels are valid and rank transparently',()=>{
 assert.equal(cleanPackageTier('premium'),'premium');
 assert.equal(cleanPackageTier('featured'),'featured');
 assert.equal(cleanPackageTier('anything'),'standard');
 assert.ok(tierRank('premium')>tierRank('featured'));
 assert.ok(tierRank('featured')>tierRank('standard'));
 assert.equal(tierLabel('featured'),'Öne Çıkan');
 assert.equal(tierLabel('premium'),'Premium · Öne Çıkan');
});
test('public listing query prioritizes tier and returns the visible package badge data',async()=>{
 let sql='';const db={prepare(value){sql=value;return{bind(){return this},async all(){return{results:[{id:'listing_123456',package_tier:'featured',business_name:'Firma'}]}}}}};
 const rows=await publicItems(db,{city:'Ankara'});
 assert.match(sql,/CASE l\.package_tier WHEN 'premium' THEN 2 WHEN 'featured' THEN 1/);
 assert.match(sql,/l\.package_tier/);
 assert.equal(rows[0].package_tier,'featured');
 assert.equal(rows[0].business_name,'Firma');
});
