import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isNew,NEW_SECONDS,tenderPage,simplifyJobScript,dispatchNotifications} from '../workers/opportunities/worker.mjs';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
test('new badge excludes unknown, future and old publication dates',()=>{
  const now=1800000000;
  assert.equal(isNew(now,now),true);
  assert.equal(isNew(now-NEW_SECONDS+1,now),true);
  for(const value of [null,0,'bad',now+1,now-NEW_SECONDS])assert.equal(isNew(value,now),false);
});
test('tender page escapes content and uses publication time for badges',async()=>{
  const now=Math.floor(Date.now()/1000);
  const env={DB:{prepare(sql){return {bind(){return this},async all(){return {results:sql.startsWith('SELECT DISTINCT')?[{city:'Konya'}]:[{id:'safe',title:'<script>alert(1)</script>',city:'Konya',public_at:now,public_expires_at:now+86400}]}}}}}};
  const response=await tenderPage(new Request('https://yukvinc.com.tr/ihale-duyurulari/?q=%22%3E%3Cscript%3E'),env);
  const html=await response.text();
  assert.ok(html.includes('Yeni paylaşıldı'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('/ihale-basvuru/safe/'));
});
test('job simplification preserves unknown upstream contracts',()=>{
  const original='function jobsPage(){return 1}';
  assert.equal(simplifyJobScript(original),original);
  const result=simplifyJobScript('function siteOfferHeader(){return "old"}\nfunction jobsPage(){return 2}');
  assert.ok(result.includes('E-posta bildirimleri'));
  assert.ok(result.endsWith('function jobsPage(){return 2}'));
});
test('email dispatcher requires configured sender before querying recipients',async()=>{
  await assert.rejects(dispatchNotifications({}),/göndericisi/);
});
test('email dispatch excludes expired, historical, inactive and opted-out users and prevents duplicates',async()=>{
  const database=new DatabaseSync(':memory:');
  database.exec('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,role TEXT,active INTEGER,email_notifications INTEGER,created_at INTEGER); CREATE TABLE lead_radar_leads(id TEXT PRIMARY KEY,title TEXT,city TEXT,status TEXT,public_at INTEGER,public_expires_at INTEGER);');
  database.exec(readFileSync(new URL('../migrations/0016_tender_notifications.sql',import.meta.url),'utf8'));
  const now=Math.floor(Date.now()/1000);
  database.prepare('UPDATE tender_notification_state SET activated_at=?').run(now-1000);
  for(const [id,active,preference] of [['yes',1,1],['off',1,0],['inactive',0,1]])database.prepare("INSERT INTO users VALUES(?,?,'member',?,?,?)").run(id,id+'@example.com',active,preference,now-2000);
  for(const [id,publicAt,expiresAt] of [['new',now-100,now+1000],['old',now-2000,now+1000],['expired',now-100,now-1]])database.prepare("INSERT INTO lead_radar_leads VALUES(?,'Test ihale','Konya','approved',?,?)").run(id,publicAt,expiresAt);
  const sent=[];
  const env={NOTIFICATION_FROM:'test@example.com',EMAIL:{async send(message){sent.push(message)}},DB:{prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return database.prepare(sql).get(...args)},async all(){return {results:database.prepare(sql).all(...args)}},async run(){const result=database.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}}}}}}};
  await dispatchNotifications(env);
  await dispatchNotifications(env);
  assert.equal(sent.length,1);
  assert.equal(sent[0].to,'yes@example.com');
  assert.match(sent[0].text,/ihale-basvuru\/new/);
  assert.match(sent[0].text,/ihale-bildirimleri\/\?token=/);
  assert.deepEqual(database.prepare('SELECT status FROM tender_email_outbox').all().map(row=>row.status),['sent']);
  database.close();
});
