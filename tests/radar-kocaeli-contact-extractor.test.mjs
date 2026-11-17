import test from 'node:test';
import assert from 'node:assert/strict';
import {extractInstitutionalContact} from '../functions/_lib/radar-kocaeli-contact-extractor.js';
const base={sourceKind:'official_organization_page',
 sourceUrl:'https://ornek-belediye.gov.tr/iletisim',organizationVerified:true};
test('Extract explicitly public business switchboard as admin-only',()=>{
 const r=extractInstitutionalContact({...base,publicContent:'Kurum Santral: 0262 318 33 22'});
 assert.equal(r.ok,true);assert.equal(r.phone,'+902623183322');
 assert.equal(r.adminOnly,true);
});
test('Extract an institutional contact email without inventing a phone',()=>{
 const r=extractInstitutionalContact({...base,
  publicContent:'Kurumsal E-Posta: satinalma@ornek-belediye.gov.tr'});
 assert.equal(r.ok,true);assert.equal(r.email,'satinalma@ornek-belediye.gov.tr');
 assert.equal(r.phone,null);
});
test('Ignore unlabeled phone from random public text or company ad',()=>{
 const r=extractInstitutionalContact({...base,publicContent:'Yük kaldırma hizmeti almak için 0532 000 00 00'});
 assert.equal(r.ok,false);assert.equal(r.phone,null);
});
test('Never extract from private social accounts or unverified organizations',()=>{
 assert.equal(extractInstitutionalContact({...base,fromPrivateAccount:true,
  publicContent:'Kurum Santral: 0262 318 33 22'}).ok,false);
 assert.equal(extractInstitutionalContact({...base,organizationVerified:false,
  publicContent:'Kurum Santral: 0262 318 33 22'}).ok,false);
 assert.equal(extractInstitutionalContact({...base,sourceKind:'social_media',
  publicContent:'Kurum Santral: 0262 318 33 22'}).ok,false);
});
test('Reject forged source URLs and noninstitutional contact labels',()=>{
 assert.equal(extractInstitutionalContact({...base,sourceUrl:'http://192.168.0.1/internal',
  publicContent:'Santral: 0262 318 33 22'}).ok,false);
 assert.equal(extractInstitutionalContact({...base,publicContent:'Satılık vinç, ara: 0262 318 33 22'}).ok,false);
});
