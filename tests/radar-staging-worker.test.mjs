import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../staging/radar-worker.mjs';

function env() {
  const queries = [];
  return {
    queries,
    DB: {
      prepare(sql) {
        queries.push(sql);
        return {
          async all() {
            if (sql.includes('GROUP BY priority')) return {results:[{priority:1,count:6},{priority:2,count:7},{priority:3,count:68}]};
            if (sql.includes('GROUP BY category')) return {results:[{category:'crane',count:8},{category:'basket',count:6},{category:'tow',count:6},{category:'machine',count:6},{category:'lift',count:5}]};
            if (sql.includes('COUNT(*) AS count,SUM')) return {results:[{count:0,active:0}]};
            if (sql.includes('FROM radar_search_profiles')) return {results:[{count:81}]};
            if (sql.includes('COUNT(*) AS count')) return {results:[{count:0}]};
            if (sql.includes('FROM radar_keyword_rules')) return {results:[{category:'crane',phrase:'vinç lazım',normalized_phrase:'vinc lazim'}]};
            return {results:[]};
          }
        };
      }
    },
    AI: {}
  };
}
const request=(path, init)=>new Request('https://staging.example/'+path.replace(/^\//,''),init);
test('GET health returns staging readiness without touching production',async()=>{
 const e=env(),res=await worker.fetch(request('/health'),e);
 assert.equal(res.status,200);const data=await res.json();
 assert.equal(data.stageOnly,true);assert.equal(data.provinceProfiles,81);
 assert.equal(data.cronEnabled,false);
 assert.ok(e.queries.every(q=>/^\s*SELECT\s/i.test(q)));
});
test('staging diagnostics do not invent leads',async()=>{
 const e=env(),res=await worker.fetch(request('/api/radar/status'),e);
 const data=await res.json();assert.equal(data.production,false);assert.equal(data.automatedScanning,false);
 assert.equal(data.activeSources,0);assert.equal(data.candidates,0);
 assert.ok(e.queries.every(q=>/^\s*SELECT\s/i.test(q)));
});
test('staging front page renders safely',async()=>{
 const res=await worker.fetch(request('/'),env()); assert.equal(res.status,200);
 const html=await res.text();assert.match(html,/YukVinc Is Radari/);
 assert.match(res.headers.get('content-security-policy'),/default-src 'none'/);
});
test('preview is rule-only, never AI or publication',async()=>{
 const e=env();const res=await worker.fetch(request('/api/radar/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Gebze vinç lazım yarın'})}),e);
 const v=await res.json();assert.equal(v.status,'needs_review');assert.equal(v.aiUsed,false);assert.equal(v.published,false);
 assert.deepEqual(v.matchedCategories,['crane']);
});
test('sale or operator recruitment excluded',async()=>{
 for(const text of ['50 ton vinç satılık fırsat','Vinç operatörü aranıyor hemen']) {
 const res=await worker.fetch(request('/api/radar/preview',{method:'POST',body:JSON.stringify({text})}),env());
 assert.equal((await res.json()).status,'rejected');
 }
});
test('invalid input rejected',async()=>{
 const res=await worker.fetch(request('/api/radar/preview',{method:'POST',body:'broken'}),env());
 assert.equal(res.status,400);
});
