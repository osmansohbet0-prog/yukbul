import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteD1} from './fixtures/sqlite-d1.mjs';
import {onRequestPost} from '../functions/api/ai/nearby.js';

async function seed(db, id, category, offsetKm) {
  const latitude = 37.87 + offsetKm / 111;
  const longitude = 32.49;
  await db.prepare(
    "INSERT INTO listings(id,user_id,listing_type,category,title,description,city,district,status,created_at,updated_at) VALUES(?,'admin_123456','equipment',?,?,?,'Konya','Meram','approved',unixepoch(),unixepoch())",
  ).bind(id, category, category === 'tow' ? 'Konya oto kurtarıcı' : 'Konya kiralık vinç',
    category === 'tow' ? 'Çekici hizmeti' : 'Vinç hizmeti').run();
  await db.prepare(
    'INSERT INTO listing_locations(listing_id,latitude,longitude,verified_by) VALUES(?,?,?,?)',
  ).bind(id, latitude, longitude, 'admin_123456').run();
}

function nearbyRequest(body) {
  return new Request('https://yukvinc.com.tr/api/ai/nearby', {
    method: 'POST',
    headers: {
      origin: 'https://yukvinc.com.tr',
      'content-type': 'application/json',
      'cf-connecting-ip': '192.0.2.10',
    },
    body: JSON.stringify(body),
  });
}

test('nearby filtering selects the requested category before the top-three limit', async () => {
  const DB = sqliteD1();
  try {
    DB.sqlite.exec(
      "INSERT INTO users(id,email,email_norm,role,active) VALUES('admin_123456','owner@example.test','owner@example.test','admin',1)",
    );
    await seed(DB, 'crane_near_01', 'crane', 0.5);
    await seed(DB, 'crane_near_02', 'crane', 1);
    await seed(DB, 'crane_near_03', 'crane', 1.5);
    await seed(DB, 'tow_near_001', 'tow', 2);

    const allResponse = await onRequestPost({
      request: nearbyRequest({latitude: 37.87, longitude: 32.49, radius_km: 25}),
      env: {DB},
    });
    assert.equal(allResponse.status, 200);
    const allItems = (await allResponse.json()).items;
    assert.equal(allItems.length, 3);
    assert.ok(allItems.every((item) => item.category === 'crane'));

    const towResponse = await onRequestPost({
      request: nearbyRequest({
        latitude: 37.87,
        longitude: 32.49,
        radius_km: 25,
        category: 'tow',
      }),
      env: {DB},
    });
    assert.equal(towResponse.status, 200);
    const towItems = (await towResponse.json()).items;
    assert.equal(towItems.length, 1);
    assert.equal(towItems[0].id, 'tow_near_001');
    assert.equal(towItems[0].category, 'tow');
  } finally {
    DB.sqlite.close();
  }
});

test('nearby search rejects unknown category values', async () => {
  const DB = sqliteD1();
  try {
    const response = await onRequestPost({
      request: nearbyRequest({
        latitude: 37.87,
        longitude: 32.49,
        radius_km: 25,
        category: 'bicycle',
      }),
      env: {DB},
    });
    assert.equal(response.status, 400);
  } finally {
    DB.sqlite.close();
  }
});
