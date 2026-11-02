import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import adminAssets from '../src/admin-panel-assets.js';
import jobAssets from '../src/job-board-assets.js';
test('delivered admin module mounts a separate lazy tab and escapes recruitment content',async()=>{
 const script=readFileSync(new URL('../public/assets/lab-recruitment-admin.js',import.meta.url),'utf8'),fields=new Map();let panel,nav,requests=0;
 const element=()=>({hidden:false,dataset:{},options:[{}],value:'',textContent:'',innerHTML:'',classList:{toggle(){}},addEventListener(name,fn){this[name]=fn;},append(value){this.options.push(value);},querySelector(s){if(!fields.has(s))fields.set(s,element());return fields.get(s);},querySelectorAll(){return [];}});
 const tabs={insertBefore(value){nav=value;},querySelector(){return null;},querySelectorAll(){return [];}},dashboard={hidden:false,append(value){panel=value;},querySelectorAll(){return panel?[panel]:[];}},document={querySelector(s){return s==='#dashboard'?dashboard:s==='.admin-tabs'?tabs:null;},createElement:element};
 vm.runInNewContext(script,{document,Date,encodeURIComponent,setTimeout,clearTimeout,fetch:async()=>{requests++;return {ok:true,json:async()=>({summary:{open:0,unverified:1,closed:0},provinces:['İstanbul'],coverage:'Bağlı kaynaklar',aiEnabled:true,sources:[],directories:[],items:[{title:'<img src=x onerror=alert(1)>',status:'unverified',source_url:'https://example.edu.tr/job',evidence:[],ai_status:'checked'}]})};}});
 assert.equal(requests,0);assert.equal(nav.dataset.tab,'lab-recruitment');assert.equal(panel.hidden,true);nav.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(requests,1);assert.equal(panel.hidden,false);assert.match(fields.get('#lab-items').innerHTML,/&lt;img/);assert.doesNotMatch(fields.get('#lab-items').innerHTML,/<img/);
 const delivered=readFileSync(new URL('../public/assets/job-admin.js',import.meta.url),'utf8');assert.equal(adminAssets.jobAdminJs,delivered);assert.equal(jobAssets['/assets/job-admin.js'][1],delivered);assert.ok(delivered.endsWith(script));
});
