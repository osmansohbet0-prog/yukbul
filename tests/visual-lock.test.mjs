// YükVinç visual contract — frozen November 17, 2026 after restoring the
// November 9 homepage overlay. These source files are the underlying website.
// Do not update their expected hashes just to make CI pass: obtain explicit
// approval for a UI change and verify desktop/mobile/admin presentation first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const protectedVisualFiles = {
  'public/index.html': '37d9a1db931f2bcfc00f2f54a52618ad0e4bdb20',
  'public/admin/index.html': '0222d30c068486e7d9b2a3d9e9effef4d69b732c',
  'public/assets/site.css': 'aaacac6135197b21e283c5a3a1e12869dcbc7604',
  'public/assets/admin-layout.css': '1a354023dab770b33dfaea3b8b3378a4dfcdde20',
  'public/assets/sidebar.js': '88d4602427e06d2bed69895bb4ffc0a6ca693cd2',
  'public/assets/site.js': '24e5bcb9519b7c7f5e9fe803f044a1d06b5ac32f',
  'functions/_lib/public-styles.js': '4b9f46a968e5cdad17c16175cdbd13ea408f2d0c',
  'functions/_lib/home-render.js': 'dfcdad4e36dee89ac8676710d85b31152160d266',
};

for (const [path, expectedBlobHash] of Object.entries(protectedVisualFiles)) {
  test(`visual layout is protected: ${path}`, async () => {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    const actualBlobHash = createHash('sha1')
      .update(`blob ${bytes.byteLength}\0`)
      .update(bytes)
      .digest('hex');
    assert.equal(actualBlobHash, expectedBlobHash,
      `${path} affects YükVinç's approved appearance. Do not change it without explicit owner approval, a desktop/mobile visual review, and a documented baseline update.`);
  });
}

test('main page and admin keep required stylesheet and script links', async () => {
  const [home, admin, config] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/admin/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
  ]);
  assert.match(home, /\/assets\/site\.css/);
  assert.match(home, /\/assets\/sidebar\.js/);
  assert.match(home, /\/assets\/site\.js/);
  assert.match(admin, /\/assets\/site\.css/);
  assert.match(admin, /\/assets\/admin-layout\.css/);
  assert.match(admin, /\/assets\/admin\.js/);
  const wrangler = JSON.parse(config);
  assert.equal(wrangler.assets.binding, 'ASSETS');
  assert.equal(wrangler.assets.directory, './public');
  assert.ok(wrangler.routes.some(route => route.pattern === 'yukvinc.com.tr' && route.custom_domain));
});
