import test from 'node:test';
import assert from 'node:assert/strict';
import {runImprovementReview} from '../functions/_lib/ai-improvements.js';

test('scheduled review removes expired AI and support data before checking model state',async()=>{
 const queries=[];
 const db={prepare(sql){queries.push(sql);return{bind(){return this},async run(){return{success:true}},async first(){return{n:0}}}}};
 const result=await runImprovementReview({DB:db,AI_ENABLED:'false'});
 assert.equal(result.reason,'ai_unavailable');
 assert.ok(queries.some(x=>x.includes('DELETE FROM ai_conversations')));
 assert.ok(queries.some(x=>x.includes('DELETE FROM ai_audit')));
 assert.ok(queries.some(x=>x.includes('UPDATE support_tickets SET contact_name=NULL')));
 assert.ok(queries.some(x=>x.includes('DELETE FROM support_tickets')));
});
