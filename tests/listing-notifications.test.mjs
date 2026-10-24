import test from 'node:test';
import assert from 'node:assert/strict';
import {notifyListingPublished} from '../functions/_lib/notifications.js';

function envWithEmail() {
  const state={sent:[],audits:[]};
  return {state,env:{ADMIN_EMAIL:'owner@example.test',LISTING_NOTIFICATION_FROM:'notifications@yukvinc.com.tr',EMAIL:{async send(message){state.sent.push(message)}},DB:{prepare(sql){return{bind(...args){this.args=args;return this},async run(){state.audits.push({sql,args:this.args});return{success:true}}}}}}};
}

test('publication notification goes only to the configured private recipient and records an audit event',async()=>{
  const {env,state}=envWithEmail();
  const result=await notifyListingPublished(env,'admin-1',{id:'listing-1',title:'Vinç & platform',city:'İzmir'});
  assert.equal(result,'sent');
  assert.equal(state.sent.length,1);
  assert.equal(state.sent[0].to,'owner@example.test');
  assert.match(state.sent[0].html,/Vinç &amp; platform/);
  assert.doesNotMatch(JSON.stringify(state.sent[0]),/contact|phone|member@example/);
  assert.equal(state.audits.length,1);
  assert.equal(state.audits[0].args[1],'listing.published.notification');
  assert.deepEqual(JSON.parse(state.audits[0].args[4]),{status:'sent'});
});

test('missing notification settings keep publication non-blocking and do not send',async()=>{
  const {env,state}=envWithEmail();
  delete env.LISTING_NOTIFICATION_FROM;
  const result=await notifyListingPublished(env,'admin-1',{id:'listing-1',title:'Vinç',city:'İzmir'});
  assert.equal(result,'not_configured');
  assert.equal(state.sent.length,0);
  assert.equal(JSON.parse(state.audits[0].args[4]).status,'not_configured');
});

