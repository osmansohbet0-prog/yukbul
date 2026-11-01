import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKocaeliSearchQueries,isRecentSourcePublication,sourceSearchScope} from '../functions/_lib/radar-kocaeli-search-plan.js';
const NOW=Date.parse('2026-11-02T09:00:00+03:00');
test('Produces real buyer-intent searches for six Kocaeli priority districts',()=>{
 const x=buildKocaeliSearchQueries({now:NOW,limit:150});
 assert.equal(x.length,96);
 for(const region of ['Gebze','Dilovası','Çayırova','Darıca','Körfez','Kartepe'])
  assert.ok(x.some(q=>q.region===region&&q.kind==='direct'&&q.channel==='web'),region);
 assert.ok(x.every(q=>q.sourcePublishedAtRequired&&q.automaticPublication===false));
});
test('Long term, industrial lifting, public tenders and short market jobs included',()=>{
 const x=buildKocaeliSearchQueries({now:NOW,limit:100,platforms:false});
 const kinds=new Set(x.map(q=>q.kind));
 for(const k of ['direct','long_term','industrial','tender','construction','short_market'])
  assert.ok(kinds.has(k),k);
 assert.ok(x.some(q=>q.query.includes('makine indirme')));
 assert.ok(x.some(q=>q.query.includes('vinç hizmet alımı')));
});
test('Google exclusion cannot reject buyer saying uygun vinç lazım',()=>{
 const x=buildKocaeliSearchQueries({now:NOW,limit:100});
 assert.ok(x.every(q=>!q.query.includes('-uygun')));
 assert.ok(x.some(q=>q.query.includes('-hizmetinizdeyiz')));
 assert.ok(x.some(q=>q.query.includes('-"vinç operatörü aranıyor"')));
});
test('Searches publicly indexed Facebook, Instagram, LinkedIn and Sahibinden only',()=>{
 const x=buildKocaeliSearchQueries({now:NOW,limit:100});
 const expected=['facebook','instagram','linkedin','sahibinden'];
 for(const p of expected)assert.equal(x.filter(q=>q.channel===p).length,6,p);
 assert.ok(x.filter(q=>expected.includes(q.channel)).every(q=>q.accessMethod==='public_index_only'));
 assert.equal(sourceSearchScope(x.find(q=>q.channel==='facebook')).allowAutomaticPublish,false);
});
test('Last 24 hours uses publisher ISO timestamp, not index or relative time',()=>{
 assert.equal(isRecentSourcePublication('2026-11-02T08:30:00+03:00',{now:NOW}),true);
 assert.equal(isRecentSourcePublication('2026-11-01T08:59:00+03:00',{now:NOW}),false);
 assert.equal(isRecentSourcePublication('2026-11-02T10:00:00+03:00',{now:NOW}),false);
 assert.equal(isRecentSourcePublication('2h ago',{now:NOW}),false);
 assert.equal(isRecentSourcePublication('2026-11-02',{now:NOW}),false);
});
test('Invalid query planning parameters rejected',()=>{
 assert.throws(()=>buildKocaeliSearchQueries({limit:0}),/invalid_limit/);
 assert.throws(()=>buildKocaeliSearchQueries({now:NaN}),/invalid_now/);
 assert.equal(buildKocaeliSearchQueries({now:NOW,limit:2}).length,2);
});
