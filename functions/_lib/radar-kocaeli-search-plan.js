/**
 * YükVinç - Kocaeli/Gebze crane rental buyer discovery.
 *
 * This module generates search-provider queries and audit metadata ONLY.
 * It does NOT scrape Google, LinkedIn, Instagram, Facebook or Sahibinden.
 * Execute queries through authorized search API or interactive search; source
 * access, publication and republishing rights need separate checks.
 */
const REGIONS=Object.freeze([
  {label:'Gebze',tier:1,province:'Kocaeli'},
  {label:'Dilovası',tier:1,province:'Kocaeli'},
  {label:'Çayırova',tier:1,province:'Kocaeli'},
  {label:'Darıca',tier:1,province:'Kocaeli'},
  {label:'Körfez',tier:1,province:'Kocaeli'},
  {label:'Kartepe',tier:1,province:'Kocaeli'},
  {label:'İzmit',tier:2,province:'Kocaeli'},
  {label:'Derince',tier:2,province:'Kocaeli'},
  {label:'Başiskele',tier:2,province:'Kocaeli'},
  {label:'Tuzla',tier:2,province:'İstanbul'},
  {label:'Altınova',tier:2,province:'Yalova'},
  {label:'Sakarya',tier:3,province:'Sakarya'}
]);
const SEARCH_GROUPS=Object.freeze([
  {key:'direct_buyer',intent:'direct',phrase:'("vinç aranıyor" OR "vinç lazım" OR "vinç ihtiyacı" OR "vinç teklifi" OR "hiyap aranıyor")',importance:100},
  {key:'long_term',intent:'long_term',phrase:'("aylık vinç" OR "3 aylık vinç" OR "vinç kiralama sözleşmesi" OR "proje boyunca vinç" OR "sürekli vinç ihtiyacı")',importance:95},
  {key:'industrial_lift',intent:'industrial',phrase:'("makine indirme" OR "makine yerleştirme" OR "fabrika makine montaj" OR "pres makinesi taşıma" OR "ağır yük kaldırma") (vinç OR hiyap OR mobil)',importance:85},
  {key:'tender',intent:'tender',phrase:'("vinç kiralama ihalesi" OR "vinç hizmet alımı" OR "operatörlü vinç kiralama" OR "sepetli vinç hizmet alımı")',importance:90},
  {key:'construction',intent:'construction',phrase:'("şantiyemize vinç" OR "şantiye vinç ihtiyacı" OR "prefabrik montaj vinç" OR "çelik konstrüksiyon vinç kiralama")',importance:80},
  {key:'short_market',intent:'short_market',phrase:'("bugün vinç lazım" OR "yarın vinç lazım" OR "günlük vinç aranıyor" OR "vinç için fiyat teklifi")',importance:70}
]);
const PLATFORM_DOMAINS=Object.freeze([
  {id:'facebook',domain:'facebook.com',method:'public_index_only'},
  {id:'linkedin',domain:'linkedin.com/posts',method:'public_index_only'},
  {id:'instagram',domain:'instagram.com',method:'public_index_only'},
  {id:'sahibinden',domain:'sahibinden.com',method:'public_index_only'}
]);
// These exclusions are deliberately narrowly targeted. "uygun" must not be
// excluded: e.g. "Gebze için uygun 50 ton vinç lazım" is a valid buyer signal.
const SEARCH_EXCLUSIONS=Object.freeze([
 '-hizmetinizdeyiz','-filomuz','-kiralıkvinçhizmeti','-"kiraya veriyoruz"',
 '-"operatör iş ilanı"','-"vinç operatörü aranıyor"','-"satılık vinç"'
]);
function localDay(now) {
  const date=new Date(now);
  if(!Number.isFinite(date.valueOf()))throw new RangeError('invalid_now');
  const items=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const obj=Object.fromEntries(items.map(x=>[x.type,x.value]));
  return obj.year+'-'+obj.month+'-'+obj.day;
}
export function buildKocaeliSearchQueries({now=Date.now(),limit=100,platforms=true}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>1000)throw new RangeError('invalid_limit');
  const day=localDay(now);
  const exclusions=SEARCH_EXCLUSIONS.join(' ');
  const groups=SEARCH_GROUPS.flatMap(g=>REGIONS.map(region=>{
    const place=region.province==='Kocaeli'?'("'+region.label+'" OR "Kocaeli '+region.label+'")':'"'+region.label+'"';
    const query=place+' '+g.phrase+' '+exclusions;
    return {id:'web:'+region.label+':'+g.key,query,region:region.label,province:region.province,
      tier:region.tier,kind:g.intent,priority:g.importance+(4-region.tier)*10,
      channel:'web',searchDate:day,sourcePublishedAtRequired:true,automaticPublication:false};
  }));
  const social=platforms?PLATFORM_DOMAINS.flatMap(p=>REGIONS.filter(x=>x.tier===1).map(region=>({
    id:p.id+':'+region.label,
    query:'site:'+p.domain+' "'+region.label+'" ("vinç aranıyor" OR "vinç lazım" OR "vinç ihtiyacı" OR "vinç teklifi" OR "hiyap lazım") '+exclusions,
    region:region.label,province:region.province,tier:region.tier,kind:'social_direct',
    priority:p.id==='sahibinden'?60:85,
    channel:p.id,searchDate:day,accessMethod:p.method,sourcePublishedAtRequired:true,
    automaticPublication:false
  }))):[];
  return [...groups,...social].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,limit);
}
export function isRecentSourcePublication(publishedAt,{now=Date.now(),hours=24}={}) {
  if(!Number.isFinite(now)||!Number.isFinite(hours)||hours<=0||hours>168)return false;
  // Relative timestamps such as "2h ago", Google "indexed today", and crawler
  // discovery time are not authoritative publishing evidence.
  if(typeof publishedAt!=='string'||!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(publishedAt)
    || !/(?:Z|[+-]\d{2}:\d{2})$/.test(publishedAt))return false;
  const at=Date.parse(publishedAt);
  return Number.isFinite(at)&&at<=now&&now-at<=hours*3600000;
}
export function sourceSearchScope(plan) {
  return {
    region:plan.region,channel:plan.channel,
    searchQuery:plan.query,
    requireConfirmedBuyer:true,
    requireOriginalPostTimestamp:true,
    requireVerifiedCompanyContact:true,
    // Search engines returning result != verified lead.
    allowAutomaticPublish:false,
    status:'search_candidate_only'
  };
}
