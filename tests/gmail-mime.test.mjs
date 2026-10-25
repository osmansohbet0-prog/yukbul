import test from 'node:test';
import assert from 'node:assert/strict';
import {sendGmail,decodeB64} from '../functions/_lib/gmail-outreach.js';
test('Gmail API MIME preserves Turkish content and pads and folds standard base64',async()=>{
 const body='YükVinç · Firmanızın bilgileri. '.repeat(50);let request;
 const result=await sendGmail(async(path,options)=>{request={path,...options};return{id:'gmail-test-id'}},'business@gmail.com','firma@example.test',body,'draft_test_123');
 assert.equal(result.id,'gmail-test-id');assert.equal(request.path,'messages/send');const mail=decodeB64(JSON.parse(request.body).raw),[headers,content]=mail.split('\r\n\r\n');
 const encodedSubject=headers.match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/)[1];assert.equal(encodedSubject.length%4,0);assert.equal(decodeB64(encodedSubject),'YükVinç firma kaydınız hakkında');assert.ok(content.split('\r\n').every(line=>line.length<=76));assert.equal(decodeB64(content.replace(/\r\n/g,'')),body);assert.match(headers,/To: firma@example.test/);
});
test('Gmail MIME rejects header injection and a non-Gmail sender before network access',async()=>{
 const noCall=()=>{throw Error('must not call network')};await assert.rejects(sendGmail(noCall,'business@gmail.com','x@example.test\r\nBcc: other@example.test','body','id'),/geçersiz/);await assert.rejects(sendGmail(noCall,'private@example.test','x@example.test','body','id'),/geçersiz/);
});
