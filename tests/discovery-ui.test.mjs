import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../ops/discovery/client.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../ops/discovery/discovery.css',import.meta.url),'utf8');
const workerSource=fs.readFileSync(new URL('../ops/discovery/worker.js',import.meta.url),'utf8').replace("import client from './client.txt';",'const client='+JSON.stringify(source)+';').replace("import css from './discovery.txt';",'const css='+JSON.stringify(css)+';');
const {default:worker,enhanceScript}=await import('data:text/javascript;base64,'+Buffer.from(workerSource).toString('base64'));
const sandbox={};vm.createContext(sandbox);vm.runInContext(source.split('function yvCurrentFilters()')[0],sandbox);
const rows=[
 {id:'a',title:'35 ton vinç',city:'Kocaeli',district:'Gebze',category:'crane',price_amount:300,price_unit:'saatlik',package_tier:'premium',created_at:1},
 {id:'b',title:'10 ve 110 ton vinç',city:'Kocaeli',district:'İzmit',category:'crane',price_amount:100,price_unit:'saatlik',created_at:2},
 {id:'c',title:'Vinç',city:'Ankara',district:'Merkez',category:'crane',price_amount:null,price_unit:null,created_at:3}
];
const ids=f=>Array.from(sandbox.yvFilter(rows,{category:'all',unit:'all',sort:'recommended',...f}),x=>x.id);
test('explicit price and newest sort override promotional ranking; unknown prices stay last',()=>{
 assert.deepEqual(ids({sort:'price-asc'}),['b','a','c']);assert.deepEqual(ids({sort:'newest'}),['c','b','a']);assert.deepEqual(ids({sort:'recommended'}),['a','c','b']);
});
test('location, keyword, budget and capacity combine without guessing missing capacities',()=>{
 assert.deepEqual(ids({city:'kocaeli',district:'gebze',tons:'35'}),['a']);
 assert.deepEqual(ids({q:'izmit vinc',tons:'35',max_price:'150'}),['b']);
 assert.deepEqual(ids({tons:'120'}),[]);assert.deepEqual(ids({min_price:'500',max_price:'100'}),[]);
 assert.deepEqual(Array.from(sandbox.yvTons({title:'8–90 ton vinç'})),[8,90]);assert.equal(sandbox.yvTons({title:'35 metre platform'}),null);
});
test('different fee units are grouped rather than numerically compared',()=>{
 const list=[{id:'day',price_amount:50,price_unit:'günlük'},{id:'hour',price_amount:1,price_unit:'saatlik'}];
 assert.deepEqual(Array.from(sandbox.yvFilter(list,{sort:'price-asc'}),x=>x.id),['day','hour']);
});
test('client remains valid classic JavaScript and enhancement is scoped to existing controls',()=>{
 new vm.Script(source);assert.match(source,/panel\.hidden = false/);assert.doesNotMatch(source,/fetch\(|localStorage|innerHTML\s*=.*item/);
});
test('upstream contract changes safely retain the original working script',()=>{
 const original='window.siteVersion=999;';assert.equal(enhanceScript(original).source,original);assert.equal(enhanceScript(original).changed,false);
});
test('legacy assets remain compatible while new and shared-link assets include the enhancement',async()=>{
 const upstream='function filtered(){}\nfunction refreshDistricts(){}\nfunction renderAppliedFilters(){}';
 for(const [path,enhanced]of [['/assets/site-optimized.js?v=20261108-cache1',false],['/assets/site-optimized.js?v=20261109-discovery1',true],['/assets/site.js?v=20261027d',true]]){
  let forwarded;const response=await worker.fetch(new Request('https://yukvinc.com.tr'+path),{YUKBUL:{async fetch(r){forwarded=new URL(r.url).pathname;return new Response(upstream,{headers:{etag:'old','content-type':'application/javascript'}})}}});
  assert.equal(forwarded,'/assets/site.js');assert.equal((await response.text()).includes('yvSetupDiscovery'),enhanced);assert.equal(response.headers.has('etag'),false);
 }
});
test('protected pages and APIs are forwarded unchanged if the enhancement is ever called for them',async()=>{
 for(const path of ['/giris/','/ilan-ver/','/admin/','/api/auth/google','/api/radar']){
  const original=new Response('protected',{status:401,headers:{'cache-control':'no-store','x-test':'original'}});
  const result=await worker.fetch(new Request('https://yukvinc.com.tr'+path),{YUKBUL:{async fetch(){return original}}});
  assert.equal(result,original);
 }
});
