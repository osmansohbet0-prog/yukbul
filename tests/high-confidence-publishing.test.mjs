import test from 'node:test';
import assert from 'node:assert/strict';
import {aiReview,reviewListingInBackground,publicItems} from '../functions/_lib/listings.js';

const item={id:'listing_123456',user_id:'member-1',listing_type:'equipment',category:'crane',title:'50 ton mobil vinç kiralama',description:'Konya ve ilçelerinde vinç kiralama hizmeti.',city:'Konya',district:'Meram',price_amount:5000,price_unit:'günlük',contact_phone:'05451234567',content_hash:'existing-content-hash',updated_at:1760000000};

function fixture(score=95,{images=1,risk=0,auto=true,flag=false}={}){
 const writes=[],readQueries=[],emails=[];
 const db={prepare(sql){
  readQueries.push(sql);
  return{args:[],bind(...args){this.args=args;return this},
   async first(){
    if(sql.includes('FROM site_settings'))return{value_json:JSON.stringify({enabled:true,image_review:true,auto_publish:auto,sensitivity:'balanced'})};
    if(sql.includes('SELECT risk_score'))return{risk_score:risk};
    if(sql.includes("SELECT id FROM listings WHERE id=? AND user_id=? AND status='pending'"))return{id:item.id};
    return null;
   },
   async all(){
    if(sql.includes('SELECT mime_type,image_blob'))return{results:Array.from({length:images},()=>({mime_type:'image/webp',image_blob:new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80])}))};
    return{results:[]};
   },
   async run(){writes.push({sql,args:this.args});return{meta:{changes:1}}}
  };
 }};
 const env={DB:db,AI_ENABLED:'true',ADMIN_EMAIL:'admin@example.test',LISTING_NOTIFICATION_FROM:'noreply@example.test',EMAIL:{async send(email){emails.push(email)}},AI:{async run(model){
  return model.includes('moondream')?{answer:'A mobile crane is clearly visible.'}:{response:JSON.stringify({duplicate:false,suspicious:flag,reason:'',confidence_score:score})};
 }}};
 return{db,env,writes,readQueries,emails};
}

test('AI gives explicit confidence score after checking listing image and text',async()=>{
 const f=fixture();
 const reviewed=await aiReview(f.env,f.db,item.user_id,item,item.id);
 assert.equal(reviewed.reviewed,true);
 assert.equal(reviewed.images_reviewed,1);
 assert.equal(reviewed.images_total,1);
 assert.equal(reviewed.confidence_score,95);
});
test('90+ verified review publishes only with clean rule review, image and unchanged revision',async()=>{
 const f=fixture(95);
 const outcome=await reviewListingInBackground(f.env,item.id,item.user_id,item);
 assert.equal(outcome.published,true);
 assert.ok(f.writes.some(x=>x.sql.includes("SET status='approved'")&&x.sql.includes('content_hash=? AND updated_at=?')));
 assert.ok(f.writes.some(x=>x.sql.includes("'ai.listing.auto_published'")));
});
test('90+ review does not publish if images are absent or rule risk is nonzero',async()=>{
 for(const option of [{images:0},{risk:20}]){
  const f=fixture(95,option),outcome=await reviewListingInBackground(f.env,item.id,item.user_id,item);
  assert.notEqual(outcome.published,true);
  assert.equal(f.writes.some(x=>x.sql.includes("SET status='approved'")),false);
 }
});
test('50-89 review starts 15 minute administrator-only priority, never self-publishes',async()=>{
 const f=fixture(70),outcome=await reviewListingInBackground(f.env,item.id,item.user_id,item);
 assert.notEqual(outcome.published,true);
 assert.equal(f.writes.some(x=>x.sql.includes("SET status='approved'")),false);
 const priority=f.writes.find(x=>x.sql.includes("'ai.listing.review_priority'"));
 assert.ok(priority);
 const metadata=JSON.parse(priority.args[1]);
 assert.equal(metadata.confidence_score,70);
 assert.ok(metadata.due_at>Math.floor(Date.now()/1000));
});
test('auto publication disabled means no AI decision can publish a listing',async()=>{
 const f=fixture(100,{auto:false}),outcome=await reviewListingInBackground(f.env,item.id,item.user_id,item);
 assert.notEqual(outcome.published,true);
 assert.equal(f.writes.some(x=>x.sql.includes("SET status='approved'")),false);
});
test('district filter is always parameterized, independent of city',async()=>{
 let sql='',bindArgs=[];
 const db={prepare(query){sql=query;return{bind(...args){bindArgs=args;return this},async all(){return{results:[]}}}}};
 await publicItems(db,{city:'Konya',district:'Meram'});
 assert.match(sql,/l\\.district LIKE \\?/);
 assert.ok(bindArgs.some(x=>String(x).includes('Meram')));
});
