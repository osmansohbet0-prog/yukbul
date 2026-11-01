import test from 'node:test';
import assert from 'node:assert/strict';
import {withTenderBoard} from '../functions/_lib/tender-board.js';
const city={province_code:41,province_name:'Kocaeli',municipality_name:'Kocaeli Büyükşehir Belediyesi',homepage_url:'https://www.kocaeli.bel.tr/',announcements_url:'https://www.kocaeli.bel.tr/haberler/ihale-duyurulari/',discovery_status:'announcement_found'};
const DB={prepare(sql){return {all:async()=>({results:sql.includes('radar_city_sources')?[city]:[]})};}};
const worker=withTenderBoard({fetch:async()=>new Response('original')});
test('nonmembers cannot see tender source links or procurement details',async()=>{
 const r=await worker.fetch(new Request('https://yukvinc.com.tr/ihale-duyurulari/?il=41'),{DB});
 assert.equal(r.status,200);const html=await r.text();assert.match(html,/İş talepleri/);assert.doesNotMatch(html,/kocaeli.bel.tr|Kaynak|Resmî duyuruyu/);
});
test('invalid city and unsupported writes are rejected while existing routes stay delegated',async()=>{
 assert.equal((await worker.fetch(new Request('https://yukvinc.com.tr/ihale-duyurulari/?il=82'),{DB})).status,400);
 assert.equal((await worker.fetch(new Request('https://yukvinc.com.tr/ihale-duyurulari/',{method:'POST'}),{DB})).status,405);
 assert.equal(await (await worker.fetch(new Request('https://yukvinc.com.tr/is-talepleri/'),{DB})).text(),'original');
});
