import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/ai/support.js';

function fixture({expired=1,member=true,status='approved'}={}){
 const writes=[];
 const DB={prepare(sql){return{args:[],bind(...args){this.args=args;return this},async first(){if(sql.includes('user_login_attempts'))return{n:0};if(sql.includes('user_sessions'))return member?{id:'member_123456',email:'member@example.test',role:'member'}:null;if(sql.includes('FROM listings'))return{id:'listing_123456',title:'Mobil vinç',status,category:'crane',expired};return null},async run(){writes.push({sql,args:this.args});return{meta:{changes:1}}}}}};
 const request=new Request('https://yukvinc.com.tr/api/ai/support',{method:'POST',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json',cookie:'__Host-yv_member=member-session'},body:JSON.stringify({action:'renewal_payment_request',listing_id:'listing_123456',package_tier:'premium',payment_declared:true})});
 return{context:{request,env:{DB}},writes};
}

test('paid renewal request is recorded for manual bank verification without extending the listing',async()=>{
 const f=fixture();const response=await onRequestPost(f.context);assert.equal(response.status,201);
 const ticket=f.writes.find(x=>x.sql.startsWith('INSERT INTO support_tickets'));
 assert.match(ticket.sql,/price_request/);assert.match(ticket.args[1],/premium · 3.000 TL · 30 gün/);assert.equal(ticket.args[3],'member@example.test');
 assert.equal(f.writes.some(x=>x.sql.startsWith('UPDATE listings')),false);
 const audit=f.writes.find(x=>x.sql.startsWith('INSERT INTO ai_audit'));
 assert.equal(JSON.parse(audit.args[4]).amount_try,3000);
});

test('payment request is rejected for a listing that has not expired',async()=>{
 const f=fixture({expired:0});const response=await onRequestPost(f.context);assert.equal(response.status,409);
 assert.equal(f.writes.some(x=>x.sql.startsWith('INSERT INTO support_tickets')),false);
});

test('payment request is rejected for a listing waiting for approval',async()=>{
 const f=fixture({status:'pending'});const response=await onRequestPost(f.context);assert.equal(response.status,409);
 assert.equal(f.writes.some(x=>x.sql.startsWith('INSERT INTO support_tickets')),false);
});
