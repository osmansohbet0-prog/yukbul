/**
 * Public organization contact extraction for admin review, NEVER public job feed.
 * Invoked only after verifying source ownership and explicit institutional
 * context (e.g. "Kurum Santral: 0262 ..."). Never inspect private social data.
 */
import {normalizeTurkishPhone,normalizeBusinessEmail} from './radar-buyer-contacts.js';
const CHANNELS=new Set(['official_tender','official_organization_page']);
const PHONE_CONTEXT=/\b(kurum(?:sal)?\s+santral|santral(?:\s+tel)?|belediye\s+telefonu|idare\s+telefonu|satinalma\s+birimi\s+telefonu|telefon\s+santral|iletisim\s+telefonu)\s*[:：-]?\s*(.{0,30})/i;
const EMAIL_CONTEXT=/\b(kurumsal\s+e.?posta|idare\s+e.?posta|satinalma\s+e.?posta|iletisim\s+e.?posta)\s*[:：-]?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;
function canonicalSource(source){
 try {
  const url=new URL(source);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.'))return null;
  url.hash='';return url.href;
 } catch {return null;}
}
function flatten(html){
 return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&')
  .replace(/[ \t]+/g,' ').slice(0,300000);
}
export function extractInstitutionalContact({
 publicContent,sourceUrl,sourceKind,organizationVerified=false,fromPrivateAccount=false
}={}){
 const failed=(reason)=>({ok:false,reason,phone:null,email:null});
 if(fromPrivateAccount||!organizationVerified||!CHANNELS.has(sourceKind))
   return failed('institutional_source_not_confirmed');
 const url=canonicalSource(sourceUrl);
 if(!url)return failed('source_url_not_verified');
 const text=flatten(publicContent||'');
 const match=PHONE_CONTEXT.exec(text);
 let phone=null;
 if(match){
   const potential=match[2]?.match(/(?:\+90|0090|0)?[\s().-]*[2358]\d{2}[\s().-]*\d{3}[\s().-]*\d{2}[\s().-]*\d{2}/);
   if(potential)phone=normalizeTurkishPhone(potential[0]);
 }
 const emailFound=EMAIL_CONTEXT.exec(text);
 const email=emailFound?normalizeBusinessEmail(emailFound[2]):null;
 if(!phone&&!email)return failed('no_explicit_institutional_contact');
 return {ok:true,phone,email,sourceUrl:url,sourceKind,verifiedInstitutionalLabel:true,
   phoneEvidence:phone?match[1].trim():null,privateAccount:false,adminOnly:true};
}
