import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PROVINCES} from '../public/assets/location-tools.js';
import {searchIntent,rankAssistantListings} from '../functions/_lib/ai-search.js';
import {assistantPublicItems} from '../functions/_lib/assistant-listings.js';
import {onRequestPost as createSupportTicket} from '../functions/api/ai/support.js';

const cases=[];
for(const province of PROVINCES){
 cases.push({label:`city apostrophe ${province.name}`,query:`${province.name}'da vinç`,city:province.name,category:'crane'});
 cases.push({label:`city joined suffix ${province.name}`,query:`${province.name}daki cekici`,city:province.name,category:'tow'});
 for(const district of province.districts){
  cases.push({label:`district ${province.name}/${district.name}`,query:`${province.name} ${district.name} manlift`,city:province.name,district:district.name,category:'manlift'});
 }
}
const aliases=[
 ['vinc','crane'],['mobil vinc','crane'],['hiyap','crane'],['operator','operator'],['is arayan operator','operator'],['sepetli platform','basket'],['sepetli vinc','basket'],['manlift','manlift'],['makasli platform','manlift'],['dikey platform','manlift'],['eklemli platform','manlift'],['nakliyat asansoru','lift'],['yuk asansoru','lift'],['cekici','tow'],['oto kurtarici','tow'],['yol yardim','tow'],['mobil lastik','mobile_tire'],['mobil lastikci','mobile_tire'],['lastikci','mobile_tire'],['lastik tamiri yol yardim','mobile_tire'],['yerinde lastik tamiri','mobile_tire'],['is makinesi','machine'],['forklift','machine'],['kepce','machine'],['ekskavator','machine']
];
for(const[q,category]of aliases)cases.push({label:`category alias ${q}`,query:q,category});
for(const row of cases)test(`assistant evaluation: ${row.label}`,()=>{const result=searchIntent(row.query);assert.equal(result.city,row.city||'');assert.equal(result.district,row.district||'');assert.equal(result.category,row.category);assert.equal(result.locationAmbiguous,false);assert.equal(result.categoryAmbiguous,false)});
test('contact page offers a working message and listing correction/removal form',async()=>{
 const html=readFileSync(new URL('../public/iletisim/index.html',import.meta.url),'utf8'),script=readFileSync(new URL('../public/assets/contact.js',import.meta.url),'utf8');assert.match(html,/id="contact-request-form"/);assert.match(html,/value="correction"/);assert.match(html,/value="removal"/);assert.match(script,/listing\.required=needsListing/);assert.match(script,/fetch\('\/api\/ai\/support'/);
 const writes=[],DB={prepare(sql){return{args:[],bind(...args){this.args=args;return this},async first(){return{n:0}},async run(){writes.push({sql,args:this.args});return{meta:{changes:1}}}}}};
 const request=new Request('https://yukvinc.com.tr/api/ai/support',{method:'POST',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json','CF-Connecting-IP':'203.0.113.5'},body:JSON.stringify({message:'Konu: İlan kaldırma talebi\nİlan başlığı/numarası: KNYA12345678\n\nBu ilan güncel değil.',consent:false})});const response=await createSupportTicket({request,env:{DB}});assert.equal(response.status,201);const ticket=writes.find(x=>x.sql.includes('INSERT INTO support_tickets'));assert.ok(ticket);assert.match(ticket.args[2],/KNYA12345678/);assert.equal(ticket.args[4],null);
});
test('assistant query results are fetched fresh from the database on each search',async()=>{let calls=0;const DB={prepare(sql){return{bind(){return this},async all(){calls++;return{results:[]}}}}};await assistantPublicItems(DB,{category:'crane',city:'Konya'});await assistantPublicItems(DB,{category:'crane',city:'Konya'});assert.equal(calls,2)});test('at least 150 real location/category evaluation cases are exercised',()=>assert.ok(cases.length>=150,`only ${cases.length} cases`));
test('the reproduced prior-city leak is fixed for attached Turkish suffixes',()=>{const prior=[{role:'user',content:'Gebze’de vinç var mı?'}];const result=searchIntent('konyadaki vinc var mi',prior);assert.equal(result.city,'Konya');assert.equal(result.district,'');assert.equal(result.category,'crane');assert.equal(result.unknownLocation,false)});
test('unknown and ambiguous places never inherit a previous city or district',()=>{const prior=[{role:'user',content:'Gebze’de vinç var mı?'}];for(const query of ['Mars’ta vinç var mı?','Konya Gebze vinç']){const result=searchIntent(query,prior);assert.equal(result.city,'');assert.equal(result.district,'');assert.ok(result.unknownLocation||result.locationAmbiguous)}});
test('a strict result ranker excludes every wrong city, district, category and fee unit',()=>{const base={id:'valid',title:'25 ton mobil vinç',description:'',category:'crane',city:'Konya',district:'Meram',price_amount:10000,price_unit:'günlük'};const intent=searchIntent('Konya Meram 25 ton günlük vinç');for(const bad of [{...base,id:'wrong-city',city:'Kocaeli',district:'Gebze'},{...base,id:'wrong-district',district:'Selçuklu'},{...base,id:'wrong-category',category:'tow'},{...base,id:'wrong-unit',price_unit:'saatlik'}])assert.deepEqual(rankAssistantListings([bad],intent),[]);assert.equal(rankAssistantListings([base],intent).length,1)});
test('assistant SQL uses approved visibility and exact city/district/category equality',async()=>{let query='',args=[];const db={prepare(sql){query=sql;return{bind(...values){args=values;return this},async all(){return{results:[]}}}}};await assistantPublicItems(db,{category:'crane',city:'Konya',district:'Meram'});assert.match(query,/l\.status='approved'/);assert.match(query,/l\.city=\?/);assert.match(query,/l\.district=\?/);assert.match(query,/COALESCE\(l\.service_category,l\.category_detail,l\.category\)=\?/);assert.doesNotMatch(query,/LIKE/i);assert.deepEqual(args.slice(0,3),['crane','Konya','Meram']);assert.match(query,/trial_expires_at>unixepoch\(\)/);assert.match(query,/paid_until>unixepoch\(\)/)});



