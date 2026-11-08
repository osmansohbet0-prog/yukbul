import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicContactActions} from '../functions/_lib/public-contact.js';
import {publicItems} from '../functions/_lib/listings.js';
import {onRequestGet as listingPage} from '../functions/ilan/[id].js';
import {sqliteD1} from './fixtures/sqlite-d1.mjs';

test('quick contact is limited to valid, owner-published phone numbers', () => {
 const owner={id:'ownerlisting1234',public_source:'owner',contact_phone:'0545 123 45 67'};
 const html=publicContactActions(owner);
 assert.match(html,/href="tel:\+905451234567"/);
 assert.match(html,/href="https:\/\/wa\.me\/905451234567"/);
 assert.match(html,/data-listing-id="ownerlisting1234"/);
 assert.equal(publicContactActions({...owner,public_source:'map_no_website'}),'');
 assert.equal(publicContactActions({...owner,contact_phone:'555abc'}),'');
 assert.equal(publicContactActions({...owner,contact_phone:'212 456 78 90'}).includes('WhatsApp'),false);
 assert.match(publicContactActions({...owner,contact_phone:'0212 456 78 90'}),/href="tel:\+902124567890"/);
});

test('withdrawn directory entries are hidden in public search and detail', async () => {
 const db=sqliteD1();
 const id='withdrawn12345678';
 try {
  db.sqlite.exec("INSERT INTO users(id,email,email_norm,role) VALUES('admin1','admin@example.test','admin@example.test','admin')");
  db.sqlite.prepare("INSERT INTO listings(id,user_id,listing_type,category,title,description,city,district,contact_phone,status) VALUES(?,?,?,?,?,?,?,?,?,?)")
   .run(id,'admin1','equipment','crane','Test vinç','Kiralık ekipman ilanı','Konya','Meram','05451234567','approved');
  db.sqlite.prepare("INSERT INTO listing_directory(listing_id,source,removed_at) VALUES(?,'owner',unixepoch())").run(id);
  assert.equal((await publicItems(db)).length,0);
  assert.equal((await listingPage({env:{DB:db},params:{id,slug:'test-vinc'}})).status,404);
  db.sqlite.prepare('UPDATE listing_directory SET removed_at=NULL WHERE listing_id=?').run(id);
  const items=await publicItems(db);
  assert.equal(items.length,1);
  assert.equal(items[0].contact_phone,'05451234567');
  const page=await listingPage({env:{DB:db},params:{id,slug:'test-vinc'}});
  assert.equal(page.status,200);
 } finally {db.sqlite.close()}
});

test('all public discovery surfaces filter removed directory records',()=>{
 for(const path of [
  'functions/_lib/home-render.js',
  'functions/kategori/[slug].js',
  'functions/sehir/[slug].js',
  'functions/sitemap.xml.js'
 ]){
  const code=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(code,/removed_at IS NOT NULL/,path);
 }
});
