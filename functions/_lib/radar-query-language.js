import {PROVINCES} from '../../public/assets/turkey-locations.js';
import {normalizeTR} from './radar-kocaeli-qualification.js';

// Cheap evidence extraction only. This module performs no I/O, inference call,
// publication, contact collection or permission attestation.
const EQUIPMENT=[
 ['mobile_crane',/\b(?:mobil vinc|mobil vincler|lastik tekerlekli vinc)\b/],
 ['basket_crane',/\b(?:sepetli vinc|sepetli arac|sepetli platform)\b/],
 ['tower_crane',/\b(?:kule vinc|kule vinci)\b/],
 ['crawler_crane',/\b(?:paletli vinc|paletli vinci)\b/],
 ['truck_crane',/\b(?:hiab|hiyap|kamyon ustu vinc|katlanir bomlu vinc)\b/],
 ['manlift',/\b(?:manlift|man lift|makasli platform|eklemli platform)\b/],
 ['platform',/\b(?:platform|platformlar|platformu)\b/],
 ['telehandler',/\b(?:manito|manitou|telehandler|teleskopik forklift)\b/],
 ['crane',/\b(?:vinc|vinci|vincler|vincleri|crane)\b/]
];
const RENTAL_BUYER=/\b(?:kiralamak\s+ist(?:iyorum|iyoruz)|kiralama\s+taleb(?:i|imiz)|kiralayacagiz|kiralanacak(?:tir)?|vinc\s+lazim|(?:vinc|manlift|manito|manitou|telehandler|platform)\s+(?:araniyor|ariyoruz|lazim)|ihtiyac(?:imiz|i|a)?\s+(?:var|vardir)|hizmet\s+alinacaktir|hizmet\s+alimi|teklif\s+(?:ist(?:iyorum|iyoruz|eniyor)|bekliyoruz|toplanacaktir|alinacaktir)|fiyat\s+teklifi\s+(?:istiyoruz|alinacaktir))\b/;
const PROVIDER=/\b(?:kiraya\s+ver(?:iyoruz|iyorum|ilir)|kiralama\s+hizmetlerimiz|kiralama\s+hizmet(?:i|leri)\s+(?:veriyoruz|sunuyoruz)|hizmet\s+veriyoruz|hizmetinizdeyiz|filomuz(?:da)?|kiralik\s+vinclerimiz|vinc\s+kiralama\s+firmasi|manlift\s+kiralama\s+firmasi|manito\s+kiralama\s+firmasi)\b/;
const SALE=/\b(?:satilik|(?:vinc|manito|manlift|platform|telehandler|makine)\s+satin\s+alma|satin\s+alinmasi|satin\s+alinacak|mal\s+alimi|vinc\s+satisi|manito\s+satisi|ekipman\s+satisi)\b/;
const RECRUIT=/\b(?:(?:vinc|manlift|manito|manitou|telehandler|hiyap|hiab|kule\s+vinc)\s+(?:operatoru|operator|operatorune|soforu|personeli)\s+(?:araniyor|ariyoruz|alinacak|ihtiyaci|ihtiyac[a-z]*)|operator(?:u|une)?\s+(?:araniyor|ariyoruz|alinacak|ihtiyac[a-z]*)|operator\s+is\s+ilani|operator\s+olarak\s+is\s+ariyorum|vinc\s+operatoruyum|personel\s+alimi|ise\s+alim)\b/;
const PROJECT=/\b(?:ced\s+(?:sureci|basvurusu|olumlu|duyurusu)|temel\s+atma|temeli\s+atildi|yeni\s+fabrika|fabrika\s+yatirimi|yatirim\s+tesvik|uretim\s+tesisi|enerji\s+santrali|ges\s+projesi|res\s+projesi|celik\s+konstruksiyon\s+projesi|santiye\s+kurulumu|kapasite\s+artisi)\b/;
const HEAVY_WORK=/\b(?:makine\s+indirme|indirme\s+bindirme|pres\s+yerlestirme|fabrika\s+montaji|celik\s+montaji|agir\s+yuk\s+kaldirma)\b/;

function publicSourceUrl(raw){
 try{const u=new URL(raw);const h=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||u.port||!h.includes('.')||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.includes(':')||/^(?:\d{1,3}\.){3}\d{1,3}$/.test(h))return null;u.hash='';return u.href;}catch{return null;}
}
function capacityEvidence(text){
 const found=[];
 // Units are mandatory. In particular, dates, bare prices and telephone digits
 // cannot become tonnage. Keep the stated range; never infer a machine capacity.
 const pattern=/(?<![\d.,])(?:(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:-|–|—|ila)\s*)?(\d{1,4}(?:[.,]\d{1,2})?)\s*(ton(?:luk)?|t)(?![a-zçğıöşü\d])/giu;
 for(const match of text.matchAll(pattern)){
  const lower=Number((match[1]||match[2]).replace(',','.')),upper=Number(match[2].replace(',','.'));
  if(lower<=0||upper>5000||upper<lower)continue;
  const item={minTon:lower,maxTon:upper,evidence:match[0].trim()};
  if(!found.some(x=>x.minTon===lower&&x.maxTon===upper))found.push(item);
 }
 return found.slice(0,12);
}
function locationEvidence(text,cityHint,districtHint){
 const hay=' '+text+' ',has=name=>hay.includes(' '+normalizeTR(name)+' ');
 const cities=PROVINCES.filter(p=>has(p.name));
 const matches=PROVINCES.flatMap(p=>p.districts.filter(d=>normalizeTR(d.name)!=='merkez'&&has(d.name)).map(d=>({province:p,district:d})));
 const unknown={city:null,district:null,status:'unknown',verified:false,evidence:[]};
 if(cities.length>1)return {...unknown,status:'ambiguous',evidence:cities.map(p=>p.name)};
 let province=cities[0]||null,basis=province?'text_city':null;
 if(province){
  const foreign=matches.filter(m=>m.province.id!==province.id&&matches.filter(x=>normalizeTR(x.district.name)===normalizeTR(m.district.name)).length===1);
  if(foreign.length)return {...unknown,status:'ambiguous',evidence:[province.name,...foreign.map(x=>x.district.name)]};
 }else if(matches.length){
  const codes=new Set(matches.map(x=>x.province.id));
  if(codes.size===1){province=matches[0].province;basis='text_unique_district';}
 }
 const provided=PROVINCES.find(p=>normalizeTR(p.name)===normalizeTR(cityHint));
 if(!province&&provided){province=provided;basis='provided_context';}
 if(!province)return {...unknown,status:matches.length?'ambiguous':'unknown',evidence:[...new Set(matches.map(x=>x.district.name))]};
 const local=matches.filter(m=>m.province.id===province.id),named=[...new Set(local.map(x=>x.district.name))];
 const providedDistrict=province.districts.find(d=>normalizeTR(d.name)===normalizeTR(districtHint));
 return {city:province.name,district:named.length===1?named[0]:named.length>1?null:providedDistrict?.name||null,status:named.length>1?'ambiguous_district':basis,verified:false,evidence:[...(cities.length?[province.name]:[]),...named]};
}

export function analyzeRentalSignal(input={}){
 input=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const raw=[typeof input.title==='string'?input.title:'',typeof input.text==='string'?input.text:''].join('\n').slice(0,20000);
 const text=normalizeTR(raw),equipment=[],matchedEvidence=[];
 for(const [id,pattern] of EQUIPMENT){const match=text.match(pattern);if(match){equipment.push(id);matchedEvidence.push({kind:'equipment',phrase:match[0]});}}
 const evidence=(kind,pattern)=>{const match=text.match(pattern);if(match)matchedEvidence.push({kind,phrase:match[0]});return Boolean(match);};
 const recruitment=evidence('recruitment',RECRUIT),sale=evidence('sale',SALE),provider=evidence('provider',PROVIDER),buyer=evidence('buyer_intent',RENTAL_BUYER),project=evidence('project_indicator',PROJECT),heavyWork=evidence('work_type',HEAVY_WORK);
 let signalType='irrelevant',intentStrength=1;
 if(recruitment){signalType='recruitment';intentStrength=2;}
 else if((sale||provider)&&equipment.length){signalType='supply';intentStrength=1;}
 else if(buyer&&(equipment.length||heavyWork)){signalType='direct_demand';intentStrength=9;}
 else if(project){signalType='project_indicator';intentStrength=4;}
 else if(equipment.length||heavyWork){signalType='uncertain';intentStrength=3;}
 const location=locationEvidence(text,input.city,input.district),url=publicSourceUrl(input.sourceUrl);
 const missingEvidence=['source_access_permission','republication_permission','original_publication_verification','current_open_demand_verification'];
 if(!url)missingEvidence.push('valid_source_url');
 if(!location.city||location.status.startsWith('ambiguous')||location.status==='provided_context')missingEvidence.push('work_location_confirmation');
 if(signalType!=='direct_demand')missingEvidence.push('direct_rental_buyer_intent');
 return {signalType,intentStrength,equipment,capacities:capacityEvidence(raw),location,matchedEvidence,missingEvidence,
  automaticPublication:false,scoreMeaning:'rule_based_intent_strength_not_calibrated_probability',
  provenance:{sourceUrl:url,authorPublishedAt:typeof input.authorPublishedAt==='string'?input.authorPublishedAt.slice(0,80):null,sourceVerified:false,publicationTimeVerified:false}};
}
