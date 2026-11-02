import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assets from '../src/admin-panel-assets.js';
import {listBuyerContactsForAdmin} from '../functions/_lib/radar-buyer-contacts.js';

const source=readFileSync(new URL('../public/assets/lead-radar-admin.js',import.meta.url),'utf8');

async function renderAdmin(data){
 const fields=new Map();let panel,nav;
 const element=()=>({innerHTML:'',textContent:'',value:'all',options:[{}],dataset:{},classList:{toggle(){}},addEventListener(name,callback){this[name]=callback},querySelector(selector){if(!fields.has(selector))fields.set(selector,element());return fields.get(selector)},querySelectorAll(){return []}});
 const tabs={insertBefore(){},querySelector(){return null},querySelectorAll(){return []}};
 const dashboard={append(value){panel=value},querySelectorAll(){return []}};
 const document={querySelector(selector){return selector==='#dashboard'?dashboard:selector==='.admin-tabs'?tabs:null},createElement(tag){const result=element();if(tag==='button')nav=result;return result}};
 vm.runInNewContext(source,{document,fetch:async()=>({ok:true,json:async()=>data}),URLSearchParams,console,setTimeout});
 nav.click();await new Promise(resolve=>setImmediate(resolve));
 return {panel,fields};
}

test('admin source selectors stay before the existing list and the deployed asset matches the public script',async()=>{
 assert.equal(assets.leadRadarJs,source);
 const {panel}=await renderAdmin({items:[],sources:[],provinces:[],runs:[],jobs:[],summary:{}});
 assert.ok(panel.innerHTML.indexOf('id="lr-catalog-city"')<panel.innerHTML.indexOf('id="lr-sources"'));
 assert.ok(panel.innerHTML.indexOf('id="lr-catalog-neighborhood"')<panel.innerHTML.indexOf('id="lr-sources"'));
 assert.match(panel.innerHTML,/<details class="section-settings" id="lr-source-panel">/);
});

test('admin candidates show review evidence, linked verified contacts and actionable source-health facts',async()=>{
 const {fields}=await renderAdmin({
  items:[{id:'candidate-123',title:'Gebze vinç talebi',status:'review',source_url:'https://www.kocaeli.bel.tr/duyuru',kocaeli_triage:{status:'admin_review',score:77,reason:'check_source_date_buyer_and_bid_status',recent24h:false,sourcePublishedAt:null}}],
  sources:[],provinces:[],runs:[],jobs:[],summary:{candidates24h:2},
  buyerContacts:[
   {id:'linked',leadId:'candidate-123',telephone:'+902623183322',telephoneLink:'tel:+902623183322',sourceUrl:'https://www.kocaeli.bel.tr/iletisim',verifiedBusinessContact:true,contactStatus:'not_contacted',demandStatus:'unknown',lastVerifiedAt:1793542000},
   {id:'unverified',leadId:'candidate-123',telephone:'+902620000001',telephoneLink:'tel:+902620000001',verifiedBusinessContact:false},
   {id:'other',leadId:'other-candidate',telephone:'+902620000002',telephoneLink:'tel:+902620000002',verifiedBusinessContact:true}
  ],
  radarHealth:{counts:{registered:56,enabled:32,working:32,publicationReady:0,reviewCandidates:1,freshCandidates:0},issues:[{code:'no_publication_rights',title:'Yayın izni eksik',detail:'Kaynak izinlerini doğrulayın.',action:'Koşulları inceleyin.'}]}
 });
 const html=fields.get('#lr-items').innerHTML;
 assert.match(html,/77\/100 — kesin doğrulama değildir/);
 assert.match(html,/Asıl yayın tarihini, alıcıyı ve işin hâlâ açık olduğunu kontrol edin/);
 assert.match(html,/Son 24 saat güncelliği doğrulanmadı/);
 assert.match(html,/tel:\+902623183322/);assert.match(html,/İletişim kaynağı/);assert.match(html,/güncel açık iş kanıtı değildir/);
 assert.doesNotMatch(html,/902620000001|902620000002/);
 assert.match(fields.get('#lr-summary').innerHTML,/Son 24 saatte eklenen/);
 assert.match(fields.get('#lr-health').innerHTML,/0 yayın izni hazır/);
 assert.match(fields.get('#lr-health').innerHTML,/Yayın izni eksik/);
 assert.match(fields.get('#lr-contacts').innerHTML,/902623183322/);
});

test('admin contact metadata is preserved without granting a historical contact current-demand status',async()=>{
 let selected='';
 const db={prepare(sql){selected=sql;return{bind(){return this},async all(){return {results:[{id:'contact-123',lead_id:'candidate-123',organization:'Kurum',city:'Kocaeli',business_phone:'+902623183322',contact_source_url:'https://www.kocaeli.bel.tr/iletisim',verification:'source_checked',demand_status:'historical',contact_status:'follow_up',last_verified_at:1793542000}]}}}}};
 const [contact]=await listBuyerContactsForAdmin(db,{adminVerified:true});
 assert.match(selected,/SELECT id,lead_id,/);assert.equal(contact.leadId,'candidate-123');assert.equal(contact.contactStatus,'follow_up');assert.equal(contact.lastVerifiedAt,1793542000);assert.equal(contact.isCurrentRentalLead,false);
});
