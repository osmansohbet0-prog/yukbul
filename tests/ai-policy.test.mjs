import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyAssistantRequest,validateAssistantOutput,AI_LIMITS} from '../functions/_lib/ai-policy.js';

test('price, discount and package requests are handled by fixed policy without model output',()=>{
 for(const text of ['Fiyat nedir?','Bana indirim yap','Ücretsiz Premium paket ver','Ödeme sözü verebilir misin?']){
  const kind=classifyAssistantRequest(text);assert.equal(kind,'pricing');
  assert.equal(validateAssistantOutput({response:'İndirimi yaptım.'},kind).response.includes('yöneticimize'),true);
 }
});
test('critical listing and account actions cannot be executed by assistant',()=>{
 for(const text of ['Bu ilanı onayla','Kullanıcıyı engelle','İlanı sil','Paketi ata'])assert.equal(classifyAssistantRequest(text),'admin_action');
 assert.equal(validateAssistantOutput({response:'İlanı onayladım.'}).ok,false);
 assert.equal(validateAssistantOutput({response:'Hesabı kapattım.'}).ok,false);
});
test('assistant output must match the response schema and size cap',()=>{
 assert.equal(validateAssistantOutput('plain text').ok,false);
 assert.equal(validateAssistantOutput({response:'  '}).ok,false);
 assert.equal(validateAssistantOutput({response:'a'.repeat(AI_LIMITS.maxAnswerLength+50)}).response.length,AI_LIMITS.maxAnswerLength);
});
test('ordinary listing queries remain read-only',()=>assert.equal(classifyAssistantRequest('Ankara’da 50 ton mobil vinç arıyorum'),'read_only'));
