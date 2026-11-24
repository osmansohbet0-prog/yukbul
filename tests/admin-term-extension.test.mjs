import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPatch} from '../functions/api/admin-users.js';
import {onRequestGet as listAdminListings,onRequestPatch as extendListing} from '../functions/api/admin-listings.js';

function fixture(body){
 const writes=[];
 const DB={prepare(sql){return{args:[],bind(...args){this.args=args;return this},async first(){if(sql.includes('admin_sessions'))return{id:'admin_123456',email:'admin@example.test',role:'admin'};if(sql.includes("role='member'"))return{id:'member_123456',role:'member'};return null},async run(){writes.push({sql,args:this.args});return{meta:{changes:2}}}}}};
 const request=new Request('https://yukvinc.com.tr/api/admin-users',{method:'PATCH',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json',cookie:'__Host-yv_admin=admin-session'},body:JSON.stringify(body)});
 return{context:{request,env:{DB,ADMIN_EMAIL:'admin@example.test'}},writes};
}

test('admin can extend all eligible listings for one member and the action is audited',async()=>{
 const f=fixture({id:'member_123456',action:'extend_days',days:30});
 const response=await onRequestPatch(f.context);assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,days:30,listing_count:2});
 const update=f.writes.find(x=>x.sql.startsWith('UPDATE listings SET paid_until'));
 assert.deepEqual(update.args,[30,'member_123456']);assert.match(update.sql,/status<>'deleted'/);assert.match(update.sql,/category\)<>'operator'/);
 const audit=f.writes.find(x=>x.sql.startsWith('INSERT INTO admin_activity'));
 assert.equal(audit.args[1],'user.listing_terms.extend');assert.deepEqual(JSON.parse(audit.args[4]),{days:30,listing_count:2});
});

test('extension rejects invalid day counts without changing records',async()=>{
 const f=fixture({id:'member_123456',action:'extend_days',days:366});
 const response=await onRequestPatch(f.context);assert.equal(response.status,400);assert.equal(f.writes.length,0);
});

function listingFixture(body,{ownerRole='member',category='crane'}={}){
 const writes=[];
 const DB={prepare(sql){return{args:[],bind(...args){this.args=args;return this},async first(){if(sql.includes('admin_sessions'))return{id:'admin_123456',email:'admin@example.test',role:'admin'};if(sql.includes('FROM listing_directory'))return null;if(sql.includes('SELECT l.id,l.user_id,l.category'))return{id:'listing_123456',user_id:'member_123456',category,owner_role:ownerRole};if(sql.includes('SELECT paid_until'))return{paid_until:2000000000};return null},async run(){writes.push({sql,args:this.args});return{meta:{changes:1}}}}}};
 const request=new Request('https://yukvinc.com.tr/api/admin-listings',{method:'PATCH',headers:{origin:'https://yukvinc.com.tr','content-type':'application/json',cookie:'__Host-yv_admin=admin-session'},body:JSON.stringify(body)});
 return{context:{request,env:{DB,ADMIN_EMAIL:'admin@example.test'}},writes};
}

test('admin can extend one chosen member listing by the selected number of days',async()=>{
 const f=listingFixture({id:'listing_123456',action:'extend_days',days:30,package_tier:'premium'});
 const response=await extendListing(f.context);assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,days:30,paid_until:2000000000,package_tier:'premium'});
 const update=f.writes.find(x=>x.sql.startsWith('UPDATE listings SET paid_until'));
 assert.deepEqual(update.args,[30,'premium','listing_123456']);assert.match(update.sql,/role='admin'/);assert.match(update.sql,/<>\'operator\'/);
 assert.equal(f.writes.find(x=>x.sql.startsWith('INSERT INTO admin_activity')).args[1],'listing.terms.extend');
});

test('administrator listings stay unlimited and cannot receive a paid term extension',async()=>{
 const f=listingFixture({id:'listing_123456',action:'extend_days',days:45},{ownerRole:'admin'});
 const response=await extendListing(f.context);assert.equal(response.status,409);assert.equal(f.writes.length,0);
});

test('expired admin tab returns the badge count and only expired approved listings',async()=>{
 let listingSql='';
 const DB={prepare(sql){return{args:[],bind(...args){this.args=args;return this},async first(){if(sql.includes('admin_sessions'))return{id:'admin_123456',email:'admin@example.test',role:'admin'};if(sql.startsWith('SELECT COUNT(*) AS count'))return{count:1};return null},async all(){listingSql=sql;return{results:[{id:'listing_123456',title:'Mobil vinç',city:'Konya',district:'Meram',status:'suspended',owner_email:'member@example.test'}]}}}}};
 const request=new Request('https://yukvinc.com.tr/api/admin-listings?status=expired',{headers:{origin:'https://yukvinc.com.tr',cookie:'__Host-yv_admin=admin-session'}});
 const response=await listAdminListings({request,env:{DB,ADMIN_EMAIL:'admin@example.test'}});
 assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.expired_count,1);assert.equal(data.items.length,1);assert.equal(data.items[0].status,'suspended');
 assert.match(listingSql,/l\.status='approved'/);assert.match(listingSql,/trial_expires_at/);assert.match(listingSql,/paid_until/);
});


