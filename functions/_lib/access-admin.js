import {readBoundedText} from './core.js';

function decode(value) {
  const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}

// Only a signed Access assertion for this application can create an admin session.
export async function verifiedAccessAdminEmail(request,env,fetchKeys=fetch) {
  const token=request.headers.get('Cf-Access-Jwt-Assertion')||'';
  const issuer=String(env.ACCESS_ISSUER||'').replace(/\/$/,'');
  const audience=String(env.ACCESS_AUDIENCE||'');
  const adminEmail=String(env.ADMIN_EMAIL||'').trim().toLowerCase();
  if(!token||token.length>16384||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!audience||!adminEmail)return '';
  try {
    const parts=token.split('.');if(parts.length!==3)return '';
    const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const now=Math.floor(Date.now()/1000);
    if(header.alg!=='RS256'||!header.kid||claims.iss!==issuer||!(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(audience)||!Number.isFinite(claims.exp)||claims.exp<=now||(claims.nbf!=null&&Number(claims.nbf)>now)||String(claims.email||'').toLowerCase()!==adminEmail)return '';
    const response=await fetchKeys(issuer+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(5000),cf:{cacheTtl:300,cacheEverything:true}});
    if(!response.ok)return '';
    const {keys}=JSON.parse(await readBoundedText(response,65536));
    const jwk=keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));
    if(!jwk)return '';
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]))?adminEmail:'';
  } catch {return '';}
}
