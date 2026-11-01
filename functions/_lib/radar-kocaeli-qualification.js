/**
 * Kocaeli / Gebze customer-demand gate for the YükVinç Radar.
 * Pure functions. Do not classify providers, personnel ads or equipment purchases
 * as a rental buyer. Unknown freshness never means "open".
 */
export const TARGET_REGIONS = Object.freeze([
  'gebze','dilovasi','cayirova','darica','korfez','derince','izmit',
  'kartepe','basiskele','golcuk','tuzla','pendik','yalova','altinova','sakarya'
]);
const PRIORITY_1 = /\b(gebze|dilovasi|cayirova|darica)\b/;
const PRIORITY_2 = /\b(korfez|derince|izmit|kartepe|basiskele|golcuk|tuzla|pendik|yalova|altinova|sakarya)\b/;
const EQUIPMENT = /\b(vinc|hiyap|hiab|manito|manitou|telehandler|manlift|sepetli arac|sepetli platform|makasli platform|mobil platform|kule vinc|agir kaldirma)\b/;
const DEMAND = /\b(kiralama|kiralanacak|kiralanacaktir|kiralanmasi|kiralamak|kiralamaya|kiralik|lazim|ihtiyac|aranmakta|araniyor|hizmet alimi|teklif istiyoruz|teklif talebi|fiyat teklifi)\b/;
const PERSONNEL = /\b(vinc|hiyap|hiab|manito|manitou|telehandler|manlift|kule vinc|sepetli)\s+(operatoru|operator|sofor|soforu|isci|personel|kullanici)(?:\s+|\b)(araniyor|alinacak|basvur|is ilani|ihtiyaci|arayan|is|calisacak|alimi)\b/;
const PROVIDER = /\b(vinc kiralama hizmetlerimiz|kiraya verilir|kiralama hizmeti veriyoruz|7 24 vinc kiralama|filomuzda|kiralik vinclerimiz|hizmetinizde|vinc kiralama fiyatlari|sizlere hizmet|hizmeti sunuyoruz)\b/;
const PURCHASE = /\b(mal alimi|satin alma|satinalma|satin alinacak|satin alinmasi|satis ihalesi|satilik|satisa sunulmustur|vinc satisi)\b/;
const LONG_TERM = /\b(aylik|ay boyunca|ay sureyle|yillik|yil boyunca|yil sureyle|sozlesme suresi|santiye boyunca|proje boyunca|uzun donem|uzun sureli)\b/;
const LIFTING_ONLY = /\b(koprulu gezer vinc|tavan vinci)\b/;
export function normalizeTR(value) {
  return String(value || '').toLocaleLowerCase('tr-TR')
    .replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u')
    .replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}
function dateTime(deadline) {
  if (typeof deadline !== 'string' || !deadline.trim()) return NaN;
  const value=deadline.trim();
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (!match) return NaN;
  const [ , yy, mm, dd, hh='23', minute='59']=match;
  const iso=yy+'-'+mm+'-'+dd+'T'+hh+':'+minute+':00+03:00';
  const parsed=Date.parse(iso);
  if (!Number.isFinite(parsed)) return NaN;
  const back=new Date(parsed+3*3600000).toISOString().slice(0,16);
  return back===yy+'-'+mm+'-'+dd+'T'+hh+':'+minute ? parsed:NaN;
}
function verifiedHttpsLink(url) {
  try {
    const u=new URL(url);
    return u.protocol==='https:' && !u.username && !u.password &&
      !u.port && !u.hostname.endsWith('.invalid') && !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname);
  } catch {return false;}
}
export function qualifyCraneRentalRequest(input, now=Date.now()) {
  const data=input && typeof input==='object'?input:{};
  const text=normalizeTR([data.title,data.description,data.procurementType].join(' '));
  const location=normalizeTR([data.city,data.district,data.workLocation].join(' '));
  const result={decision:'reject',reason:'',regionPriority:0,term:'unknown',
    activeVerified:false,contactVerified:false,forPublicPublishing:false};
  if(text.length<12 || text.length>15000) {result.reason='invalid_content';return result;}
  if(!EQUIPMENT.test(text)) {result.reason='not_crane_or_lift';return result;}
  if(PERSONNEL.test(text) && !/\b(operatorlu|operator dahil)\s+(vinc|hiyap|kule vinc)?\s*kirala/.test(text)){
    result.reason='personnel_recruitment';return result;
  }
  if(PURCHASE.test(text)||(/\b(mal alimi)\b/.test(text))) {result.reason='equipment_purchase';return result;}
  if(PROVIDER.test(text)) {result.reason='crane_provider_advertisement';return result;}
  if(LIFTING_ONLY.test(text) && !DEMAND.test(text)) {result.reason='installed_equipment_not_rental';return result;}
  if(!DEMAND.test(text)) {result.reason='buyer_intent_not_established';return result;}
  if(!PRIORITY_1.test(location)&&!PRIORITY_2.test(location)&&!/\bkocaeli\b/.test(location)) {
    result.reason='outside_target_region';return result;
  }
  result.regionPriority=PRIORITY_1.test(location)?1:PRIORITY_2.test(location)?2:3;
  result.term=LONG_TERM.test(text)||Number(data.durationMonths)>=1?'monthly_or_project':'short_or_unspecified';
  if(!verifiedHttpsLink(data.sourceUrl)) {result.reason='unverifiable_source_url';return result;}
  const until=dateTime(data.deadline);
  if(Number.isFinite(until) && until<=now) {result.reason='deadline_passed';return result;}
  result.decision='needs_review';
  result.reason=Number.isFinite(until)?'future_deadline_needs_source_verification':'deadline_or_open_status_unknown';
  if(data.sourceChecked===true && data.buyerConfirmed===true && Number.isFinite(until)){
    result.decision='verified_candidate';result.activeVerified=true;
    result.reason='confirmed_buyer_and_current_deadline';
  }
  return result;
}
export function isHistoricalOrUnverified(candidate, now=Date.now()){
  return qualifyCraneRentalRequest(candidate,now).decision!=='verified_candidate';
}
