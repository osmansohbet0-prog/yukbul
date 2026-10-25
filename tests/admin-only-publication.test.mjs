import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readAiModeration,cleanAiModeration} from '../functions/_lib/ai-settings.js';
import {processListingAgent} from '../functions/_lib/listing-agent.js';
test('legacy settings cannot re-enable automatic publication',async()=>{
 const db={prepare(){return{async first(){return{value_json:JSON.stringify({enabled:true,image_review:true,auto_publish:true})}}}}};
 assert.equal((await readAiModeration(db)).auto_publish,false);
 assert.equal(cleanAiModeration({enabled:true,image_review:true,auto_publish:true,sensitivity:'balanced'}).auto_publish,false);
});
test('scheduled review never publishes even with a legacy enabled setting',async()=>{
 const statements=[];
 const db={prepare(sql){statements.push(sql);return{async first(){return{value_json:'{"enabled":true,"auto_publish":true}'}},async all(){return{results:[]}}}}};
 const result=await processListingAgent({DB:db,AI_ENABLED:'true',AI:{}});
 assert.equal(result.published,0);
 assert.ok(statements.every(sql=>!sql.includes('UPDATE listings')));
 const source=await readFile(new URL('../functions/_lib/listing-agent.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/status='approved'|notifyListingPublished|auto_published/);
});
