import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTurkishPhone,validateBuyerContact,saveBuyerContactForAdmin,
 listBuyerContactsForAdmin} from '../functions/_lib/radar-buyer-contacts.js';
const buyer={
 id:'buyer-ulasimpark-2026',organization:'UlaşımPark A.Ş.',city:'Kocaeli',district:'İzmit',
 businessPhone:'0 (262) 325 23 05',businessEmail:'bilgi@ulasimpark.com.tr',
 contactPageUrl:'https://www.ulasimpark.com.tr/iletisim',
 contactSourceUrl:'https://www.ulasimpark.com.tr/iletisim',
 sourceKind:'official_organization_page',sourceChecked:true,publicBusinessContact:true,
 demandStatus:'historical',verifiedAt:1793542000
};
test('Public organizational phone normalized for click-to-call',()=>{
 assert.equal(normalizeTurkishPhone('0 (262) 325 23 05'),'+902623252305');
 assert.equal(normalizeTurkishPhone('+90 532 286 50 67'),'+905322865067');
 assert.equal(normalizeTurkishPhone('2623252305'),'+902623252305');
 assert.equal(normalizeTurkishPhone('0090 262 325 23 05'),'+902623252305');
});
test('Reject fake short or alphabetic contact strings',()=>{
 for(const x of ['112','0262','+90 123 456 7890','0262info235','1 800 555 5555'])
  assert.equal(normalizeTurkishPhone(x),null);
});
test('Verified business phone accepted but does not imply currently open rental',()=>{
 const r=validateBuyerContact(buyer);
 assert.equal(r.ok,true);assert.equal(r.record.businessPhone,'+902623252305');
 assert.equal(r.record.demandStatus,'historical');
});
test('No invented phone, unverified source or private-only contact',()=>{
 assert.equal(validateBuyerContact({...buyer,sourceChecked:false}).ok,false);
 assert.equal(validateBuyerContact({...buyer,publicBusinessContact:false}).ok,false);
 assert.equal(validateBuyerContact({...buyer,contactSourceUrl:'http://127.0.0.1/a'}).ok,false);
 assert.equal(validateBuyerContact({...buyer,demandStatus:'open_verified'}).ok,false);
 assert.equal(validateBuyerContact({...buyer,businessPhone:'bogus'}).ok,false);
});
test('Cannot write or read contacts without authenticated admin',async()=>{
 const db={prepare(){throw Error('DB should not be accessed');}};
 await assert.rejects(saveBuyerContactForAdmin(db,{adminVerified:false},buyer),/admin_only/);
 await assert.rejects(listBuyerContactsForAdmin(db,{},null),/admin_only/);
});
test('When a real admin writes, bind evidence fields and phone only',async()=>{
 const writes=[];
 const db={prepare(sql){return {bind(...params){writes.push({sql,params});return{async run(){return {success:true}}}}}}};
 const r=await saveBuyerContactForAdmin(db,{adminVerified:true},buyer);
 assert.equal(r.ok,true);assert.equal(writes.length,1);
 assert.ok(writes[0].sql.includes('radar_buyer_contacts'));
 assert.ok(writes[0].params.includes('+902623252305'));
 assert.ok(writes[0].params.includes('historical'));
});
test('Admin reads historical buyer without mislabeling active demand',async()=>{
 const db={prepare(){return {bind(){return{async all(){return{results:[{
 id:'buyer-ulasimpark-2026',organization:'UlaşımPark A.Ş.',
 city:'Kocaeli',district:'İzmit',business_phone:'+902623252305',
 business_email:'bilgi@ulasimpark.com.tr',
 contact_page_url:'https://www.ulasimpark.com.tr/iletisim',
 contact_source_url:'https://www.ulasimpark.com.tr/iletisim',
 verification:'source_checked',demand_status:'historical',contact_status:'not_contacted',
 buyer_note:'Geçmiş ihale',last_verified_at:1793542000
 }]}}}}}}};
 const rows=await listBuyerContactsForAdmin(db,{adminVerified:true});
 assert.equal(rows.length,1);
 assert.equal(rows[0].telephoneLink,'tel:+902623252305');
 assert.equal(rows[0].isCurrentRentalLead,false);
});
