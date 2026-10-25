import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet as sitemap} from '../functions/sitemap.xml.js';
import {onRequestGet as listing} from '../functions/ilan/[id].js';
import {onRequestGet as category} from '../functions/kategori/[slug].js';
import {onRequestGet as city} from '../functions/sehir/[slug].js';
const rows=[{id:'new',title:'25 ton vinç',category:'crane',city:'Konya',district:'Meram',description:'Yük kaldırma hizmeti',created_at:1792840000,updated_at:1792840000},{id:'old',title:'Eski vinç',category:'crane',city:'Konya',district:'Selçuklu',description:'Vinç kiralama',created_at:1700000000,updated_at:1700000000}];
const env={DB:{prepare(){return{bind(){return this},async first(){return rows[0]},async all(){return{results:rows}}}}}};
test('sitemap keeps real listing timestamps without invented collection modification dates',async()=>{
 const xml=await(await sitemap({env})).text();
 const entries=xml.match(/<url>.*?<\/url>/g);
 assert.ok(entries.length>4);
 for(const entry of entries){if(entry.includes('/ilan/'))assert.match(entry,/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);else assert.doesNotMatch(entry,/<lastmod>/)}
 assert.equal(entries.filter(x=>x.includes('/sehir/konya/')).length,1);
});
test('stale and missing listing slugs redirect to a single canonical public URL',async()=>{
 for(const slug of [undefined,'old-title']){const r=await listing({env,params:{id:'new',slug}});assert.equal(r.status,301);assert.equal(r.headers.get('location'),'https://yukvinc.com.tr/ilan/new/25-ton-vinc/')}
 const r=await listing({env,params:{id:'new',slug:'25-ton-vinc'}}),html=await r.text();assert.equal(r.status,200);assert.match(html,/sizes="96x96"/);assert.match(html,/href="https:\/\/yukvinc.com.tr\/sehir\/konya\/"/);assert.match(html,/href="\/kategori\/vinc\/"/);
});
test('category and city pages expose useful guidance, real inventory and discovery links',async()=>{
 const cat=await(await category({env,params:{slug:'vinc'}})).text();assert.match(cat,/yükün ağırlığını/);assert.match(cat,/href="\/sehir\/konya\/"/);assert.match(cat,/sizes="96x96"/);
 const local=await(await city({env,params:{slug:'konya'}})).text();assert.match(local,/Konya: Vinç kiralama/);assert.match(local,/Meram, Selçuklu/);assert.match(local,/href="\/kategori\/vinc\/"/);assert.match(local,/sizes="96x96"/);
});
