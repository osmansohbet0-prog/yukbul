import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{allowedPath} from '../staging/kocaeli-source-prober.mjs';
test('Respect disallow for official announcements',()=>{
 assert.equal(allowedPath('User-agent: *\nDisallow: /duyurular','/duyurular'),false);
 assert.equal(allowedPath('User-agent: *\nDisallow: /duyurular','/ihaleler'),true);
});
test('Explicit allow can override an equally long disallow',()=>{
 assert.equal(allowedPath('User-agent: *\nDisallow: /duyurular\nAllow: /duyurular','/duyurular'),true);
});
test('Do not confuse another named user agent rules with wildcard',()=>{
 assert.equal(allowedPath('User-agent: *\nDisallow: /private\nUser-agent: Googlebot\nDisallow: /','/duyurular'),true);
});
test('Public HTTP endpoint never leaks internal source status',async()=>{
 const r=await worker.fetch();
 assert.equal(r.status,404);assert.match(await r.text(),/Not found/);
});
