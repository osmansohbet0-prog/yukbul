import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('admin login verifies the new session before opening the dashboard',()=>{
  const adminScript=readFileSync(new URL('../public/assets/admin.js',import.meta.url),'utf8');
  assert.match(adminScript,/security_code\.minLength=8/);
  assert.match(adminScript,/await api\('\/api\/admin-session'\)/);
  assert.match(adminScript,/if\(!session\.user\?\.email\)/);
  assert.match(adminScript,/button\.disabled=true/);
  assert.match(adminScript,/finally\{button\.disabled=false/);
});
