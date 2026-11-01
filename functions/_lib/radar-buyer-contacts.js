/**
 * YükVinç Radar buyer contact intelligence.
 * Intended ONLY for authenticated admin routes. Never include these records
 * in /api/jobs or public listing JSON. No automated outreach is performed.
 */
export function normalizeTurkishPhone(input) {
  if(typeof input!=='string' || input.length>64 || /[a-z]/i.test(input))return null;
  let digits=input.replace(/\D/g,'');
  if(digits.startsWith('0090'))digits=digits.slice(4);
  else if(digits.startsWith('90') && digits.length===12)digits=digits.slice(2);
  if(digits.startsWith('0') && digits.length===11)digits=digits.slice(1);
  if(!/^[2358]\d{9}$/.test(digits))return null;
  return '+90'+digits;
}
export function normalizeBusinessEmail(value){
  if(typeof value!=='string'||value.length>254)return null;
  const clean=value.trim().toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,24}$/.test(clean)?clean:null;
}
function safeHttpsSource(input){
  try{
    const u=new URL(input);
    if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||
       !u.hostname.includes('.')||/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) ||
       u.hostname==='localhost')return null;
    return u.href;
  }catch{return null;}
}
const ALLOWED_SOURCE_KINDS=new Set(['official_tender','official_organization_page','verified_business_listing']);
const ALLOWED_STATUSES=new Set(['historical','unknown','open_verified','closed']);
/**
 * Source evidence is mandatory. Reading an old tender does not mean the current
 * company wants a crane right now. Business phone must be openly published
 * for organisational contact, not recovered from private profiles.
 */
export function validateBuyerContact(input) {
  const x=input && typeof input==='object'?input:{};
  const organization=typeof x.organization==='string'?x.organization.trim():'';
  const city=typeof x.city==='string'?x.city.trim():'';
  const district=typeof x.district==='string'?x.district.trim():'';
  if(!organization || organization.length>180 || !city || city.length>70 ||
     district.length>90 || typeof x.id!=='string' || !/^[a-zA-Z0-9:_-]{8,110}$/.test(x.id)) {
    return {ok:false,reason:'invalid_buyer_identity'};
  }
  const url=safeHttpsSource(x.contactSourceUrl);
  const contactPage=x.contactPageUrl?safeHttpsSource(x.contactPageUrl):null;
  if(!url || (x.contactPageUrl && !contactPage) ||
     !ALLOWED_SOURCE_KINDS.has(x.sourceKind) ||
     !ALLOWED_STATUSES.has(x.demandStatus))return {ok:false,reason:'unverified_provenance'};
  if(x.sourceChecked!==true || x.publicBusinessContact!==true)
    return {ok:false,reason:'contact_publication_not_verified'};
  const phone=x.businessPhone?normalizeTurkishPhone(x.businessPhone):null;
  const email=x.businessEmail?normalizeBusinessEmail(x.businessEmail):null;
  if((x.businessPhone&&!phone)||(x.businessEmail&&!email))
    return {ok:false,reason:'invalid_phone_or_email'};
  if(!phone && !email && !contactPage) return {ok:false,reason:'no_verified_contact_method'};
  if(x.demandStatus==='open_verified' && x.openTenderVerified!==true)
    return {ok:false,reason:'open_demand_not_confirmed'};
  return {ok:true,record:{
    id:x.id,leadId:typeof x.leadId==='string'?x.leadId:null,
    organization,city,district:district||null,businessPhone:phone,businessEmail:email,
    contactPageUrl:contactPage,contactSourceUrl:url,contactRole:'public_organization',
    sourceKind:x.sourceKind,verification:'source_checked',demandStatus:x.demandStatus,
    buyerNote:typeof x.buyerNote==='string'?x.buyerNote.slice(0,450):'',
    lastVerifiedAt:Number.isInteger(x.verifiedAt)?x.verifiedAt:Math.floor(Date.now()/1000)
  }};
}
/** Contract: actor.adminVerified must be set ONLY after server session auth succeeds. */
export async function saveBuyerContactForAdmin(db, actor, input) {
  if(!db || !actor || actor.adminVerified!==true)throw new Error('admin_only');
  const check=validateBuyerContact(input);
  if(!check.ok)return check;
  const r=check.record;
  const sql='INSERT INTO radar_buyer_contacts (id,lead_id,organization,city,district,business_phone,business_email,contact_page_url,contact_source_url,contact_role,source_kind,verification,demand_status,buyer_note,last_verified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET business_phone=excluded.business_phone,business_email=excluded.business_email,contact_page_url=excluded.contact_page_url,contact_source_url=excluded.contact_source_url,last_verified_at=excluded.last_verified_at,updated_at=unixepoch()';
  await db.prepare(sql).bind(r.id,r.leadId,r.organization,r.city,r.district,r.businessPhone,
    r.businessEmail,r.contactPageUrl,r.contactSourceUrl,r.contactRole,r.sourceKind,
    r.verification,r.demandStatus,r.buyerNote,r.lastVerifiedAt).run();
  return {ok:true,id:r.id};
}
export async function listBuyerContactsForAdmin(db, actor, leadId=null) {
  if(!db || !actor || actor.adminVerified!==true)throw new Error('admin_only');
  const sql="SELECT id,organization,city,district,business_phone,business_email,contact_page_url,contact_source_url,source_kind,verification,demand_status,contact_status,buyer_note,last_verified_at FROM radar_buyer_contacts WHERE contact_status != ? AND (? IS NULL OR lead_id=?) ORDER BY CASE WHEN demand_status='open_verified' THEN 0 ELSE 1 END, last_verified_at DESC LIMIT 100";
  const rows=(await db.prepare(sql).bind('opt_out',leadId,leadId).all()).results||[];
  return rows.map(row=>({
    id:row.id,organization:row.organization,location:[row.district,row.city].filter(Boolean).join(', '),
    telephone:row.business_phone,
    telephoneLink:row.business_phone?'tel:'+row.business_phone:null,
    email:row.business_email,emailLink:row.business_email?'mailto:'+row.business_email:null,
    sourceUrl:row.contact_source_url,contactPage:row.contact_page_url,
    verifiedBusinessContact:row.verification!=='unverified',demandStatus:row.demand_status,
    isCurrentRentalLead:row.demand_status==='open_verified',buyerNote:row.buyer_note
  }));
}
