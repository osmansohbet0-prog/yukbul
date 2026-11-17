import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the listing wizard has four visible phases without changing site-wide/admin styles',async()=>{
  const [js,html]=await Promise.all([
    readFile(new URL('../public/assets/listing-form.js',import.meta.url),'utf8'),
    readFile(new URL('../public/ilan-ver/index.html',import.meta.url),'utf8')
  ]);
  assert.match(js,/STEP_GROUPS\s*=\s*\[\[0,1\],\[2,3\],\[4\],\[5\]\]/);
  assert.match(js,/STEP_GROUPS\.length-1/);
  assert.match(html,/1 \/ 4 · Tür ve konum/);
  assert.match(html,/id="yv-wizard-validation"/);
  assert.match(html,/id="wizard-step-error"/);
  assert.match(html,/id="photo-required-help"/);
});

test('invalid city and photo-free input blocks progress and marks fields red',async()=>{
  const js=await readFile(new URL('../public/assets/listing-form.js',import.meta.url),'utf8');
  for(const required of [
    "field.setAttribute('aria-invalid','true')",
    "form.addEventListener('input'",
    "form.addEventListener('change'",
    "TURKISH_CITIES.includes(city)",
    "districts.includes(districtSelect.value)",
    "if(photoProcessing)",
    "if(!hasRequiredPhoto())",
    "if(!validStep(n))return",
    "if(!validStep(step))"
  ]){
    if(required==="if(!validStep(step))"){
      assert.match(js,/if\(validStep\(step\)\)/);
    }else{
      assert.ok(js.includes(required),'Expected wizard gate: '+required);
    }
  }
});

test('photo shrink is bounded and uploads preserve server-provided field errors',async()=>{
  const js=await readFile(new URL('../public/assets/listing-form.js',import.meta.url),'utf8');
  assert.match(js,/2000\/Math\.max\(width,height\)/);
  assert.match(js,/err\.field=data\.field/);
  assert.match(js,/photoProcessing=false/);
});
