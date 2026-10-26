import {redactForAI} from './listings.js';
import {PROVINCES,fold as locationFold} from '../../public/assets/location-tools.js';

export const foldSearch=value=>locationFold(String(value||'').normalize('NFKC').replace(/ı/g,'i'));
const normalize=foldSearch;
const suffixes=['ndan','nden','ndan','nden','daki','deki','taki','teki','nda','nde','dan','den','tan','ten','da','de','ta','te','ya','ye','a','e'];
const suffixSet=new Set(suffixes);
const explicitCaseSuffixes=['daki','deki','taki','teki','nda','nde','dan','den','tan','ten','da','de','ta','te'];
const nonPlaceSuffixWords=new Set(['yukaridaki','yukardaki','asagidaki','buradaki','aradaki','onundeki','arkasindaki','sonraki','onceki','buraya','oraya','yakinimda','yakinimdaki','konumumda','konumumdaki','yerinde','icinde','disinda','asagida','yukarida','sirasiyla','buradan']);
const places=PROVINCES.flatMap(province=>[
 {type:'city',name:province.name,city:province.name,district:'',key:normalize(province.name)},
 ...province.districts.map(district=>({type:'district',name:district.name,city:province.name,district:district.name,key:normalize(district.name)}))
]);
const knownPlaceKeys=new Set(places.map(x=>x.key));
const placeByKey=new Map();for(const place of places){const list=placeByKey.get(place.key)||[];list.push(place);placeByKey.set(place.key,list)}
const cityByKey=new Map(PROVINCES.map(x=>[normalize(x.name),x.name]));
const districtIndex=new Map();for(const province of PROVINCES)for(const district of province.districts){const key=normalize(district.name),list=districtIndex.get(key)||[];list.push({city:province.name,district:district.name});districtIndex.set(key,list)}
const categoryAliases={
 mobile_tire:['mobil lastik','mobil lastikci','lastikci','lastik tamiri','lastik tamir','lastik degisimi','lastik yol yardim','yerinde lastik','patlak lastik','lastigim patladi','oto lastik'],
 operator:['operator','is ariyorum','is arayan','operator isi'],
 basket:['sepetli platform','sepetli vinc','sepetli','platform sepetli'],
 manlift:['manlift','makasli platform','dikey platform','eklemli platform'],
 lift:['nakliyat asansoru','yuk asansoru','esya asansoru'],
 tow:['yol yardim','cekici','oto kurtarici','kurtarici','oto kurtarma'],
 machine:['is makinesi','forklift','kepce','ekskavator','beko loader','loder'],
 crane:['mobil vinc','hiyap','hiyab','vinc','tonaj']
};
const categoryLabels={mobile_tire:'mobil lastikçi',operator:'operatör ilanı',basket:'sepetli platform',manlift:'manlift',lift:'nakliyat asansörü',tow:'çekici / yol yardımı',machine:'iş makinesi',crane:'vinç'};
const STOP=new Set('ariyorum ariyor bakiyorum lazim istiyorum olan ilan ilani ilanlari bana icin hangi nedir midir ve ile bir en yakin var mi varmi mu mu bu da de daha goster bul lutfen hizmet kiralama kiralik kirala fiyatli ucuz uygun konumumda'.split(' '));
const categoryWords=new Set(Object.values(categoryAliases).flatMap(xs=>xs.flatMap(x=>normalize(x).split(' '))));
const contains=(text,term)=>(' '+text+' ').includes(' '+term+' ');
function editDistanceOne(a,b){if(a===b)return 0;if(Math.abs(a.length-b.length)>1)return 2;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++edits>1)return 2;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}}if(i<a.length||j<b.length)edits++;return edits}
function stripCaseSuffix(token){if(knownPlaceKeys.has(token))return token;for(const suffix of suffixes){if(token.length>suffix.length+2&&token.endsWith(suffix)){const stem=token.slice(0,-suffix.length);if(knownPlaceKeys.has(stem))return stem}}return token}
function locationMatches(tokens,original=''){
 const found=[];
 for(let start=0;start<tokens.length;start++){
  for(let end=start+1;end<=Math.min(tokens.length,start+4);end++){
   const phrase=tokens.slice(start,end).join(' '),placesHere=placeByKey.get(phrase);
   if(placesHere)found.push(...placesHere.map(x=>({...x,corrected:false})));
   if(end===start+1){const stripped=stripCaseSuffix(tokens[start]);if(stripped!==tokens[start]){const attached=placeByKey.get(stripped);if(attached)found.push(...attached.map(x=>({...x,corrected:false})))} }
   const caseToken=tokens[end];if(placesHere&&caseToken&&suffixSet.has(caseToken))found.push(...placesHere.map(x=>({...x,corrected:false})));
  }
 }
 if(!found.length){
  const capitals=new Set([...String(original).matchAll(/[\p{Lu}][\p{L}]{3,}/gu)].map(x=>normalize(x[0])));
  const suffixContext=tokens.some((token,i)=>suffixSet.has(token)&&i>0||suffixSet.has(tokens[i+1])||suffixes.some(s=>token.length>s.length+2&&token.endsWith(s)));
  const locationContext=/\b(ilce|sehir|il|bolge|konum|yakini|yakinda)\b/.test(tokens.join(' '));
  for(const [index,raw]of tokens.entries()){
   let token=raw;if(!suffixSet.has(tokens[index+1]))for(const suffix of suffixes){if(token.length>suffix.length+2&&token.endsWith(suffix)){token=token.slice(0,-suffix.length);break}}
   if(token.length<5||(!capitals.has(raw)&&!suffixContext&&!locationContext))continue;
   for(const place of places){if(place.key.length<5||place.key.includes(' ')||editDistanceOne(token,place.key)!==1)continue;found.push({...place,corrected:true})}
  }
 }
 const unique=new Map();for(const x of found)unique.set(`${x.type}|${normalize(x.city)}|${normalize(x.district)}`,x);
 return[...unique.values()];
}function hasUnknownExplicitPlace(tokens,matched){
 if(matched.length)return false;
 for(let i=0;i<tokens.length;i++){
  const word=tokens[i];if(nonPlaceSuffixWords.has(word))continue;
  if(i>0&&explicitCaseSuffixes.includes(word)&&tokens[i-1].length>=3&&!STOP.has(tokens[i-1])&&!categoryWords.has(tokens[i-1]))return true;
  for(const suffix of explicitCaseSuffixes){if(word.length>suffix.length+2&&word.endsWith(suffix)){const stem=word.slice(0,-suffix.length);if(stem.length>=3&&!knownPlaceKeys.has(stem)&&!STOP.has(stem)&&!categoryWords.has(stem)&&!nonPlaceSuffixWords.has(word))return true}}
 }
 return false;
}
function resolvePlace(text){
 const tokens=normalize(text).split(' ').filter(Boolean),matches=locationMatches(tokens,text);
 const explicitCities=[...new Set(matches.filter(x=>x.type==='city').map(x=>x.city))];
 const allDistricts=matches.filter(x=>x.type==='district');let districts=allDistricts;
 if(explicitCities.length===1)districts=districts.filter(x=>normalize(x.city)===normalize(explicitCities[0]));
 const districtPairs=[...new Map(districts.map(x=>[`${normalize(x.city)}|${normalize(x.district)}`,x])).values()];
 const districtCities=[...new Set(districtPairs.map(x=>x.city))];
 const conflicts=explicitCities.length>1||(explicitCities.length===1&&allDistricts.length>0&&districtPairs.length===0)||(!explicitCities.length&&districtCities.length>1)||(districtPairs.length>1&&districtPairs.some(x=>normalize(x.city)!==normalize(districtPairs[0].city)||normalize(x.district)!==normalize(districtPairs[0].district)));
 if(conflicts)return{city:'',district:'',ambiguous:true,unknown:false,corrected:false};
 const district=districtPairs.length===1?districtPairs[0]:null;
 const city=explicitCities[0]||district?.city||'';
 return{city,district:district?.district||'',ambiguous:false,unknown:!matches.length&&hasUnknownExplicitPlace(tokens,matches),corrected:matches.some(x=>x.corrected)};
}
function categoryOf(text){
 const matches=[];
 for(const[category,aliases]of Object.entries(categoryAliases))for(const alias of aliases)if(contains(text,normalize(alias)))matches.push({category,weight:normalize(alias).split(' ').length,alias});
 if(!matches.length){const tokens=text.split(' ');for(const token of tokens){if(token.length<4)continue;for(const[category,aliases]of Object.entries(categoryAliases))for(const alias of aliases){for(const part of normalize(alias).split(' ')){if(part.length>=5&&editDistanceOne(token,part)===1)matches.push({category,weight:1,alias:part,corrected:true})}}}}
 if(!matches.length)return{category:'',ambiguous:false,categories:[],corrected:false};
 if(matches.some(x=>x.category==='mobile_tire')&&matches.some(x=>x.category==='tow'))return{category:'mobile_tire',ambiguous:false,categories:['mobile_tire'],corrected:matches.some(x=>x.corrected)};
 const max=Math.max(...matches.map(x=>x.weight)),best=[...new Set(matches.filter(x=>x.weight===max).map(x=>x.category))];
 if(best.length>1)return{category:'',ambiguous:true,categories:best,corrected:matches.some(x=>x.corrected)};
 return{category:best[0],ambiguous:false,categories:best,corrected:matches.some(x=>x.corrected)};
}
export function cleanAssistantHistory(value){return(Array.isArray(value)?value:[]).slice(-4).filter(x=>x&&x.role==='user'&&typeof x.content==='string').map(x=>({role:'user',content:redactForAI(x.content).slice(0,600)}))}
const feeUnitOf=text=>{if(/\b(saatlik|saat basi|saat)\b/.test(text))return'saatlik';if(/\b(gunluk|gun basi)\b/.test(text))return'gunluk';if(/\b(aylik|ay)\b/.test(text))return'aylik';if(/\b(is basi|sefer basi|seferlik|sefer)\b/.test(text))return'is_basi';if(/\b(teklif|fiyat sor)\b/.test(text))return'teklif';return''};
export const canonicalUnit=value=>{const text=normalize(value);if(/saat/.test(text))return'saatlik';if(/gun/.test(text))return'gunluk';if(/ay/.test(text))return'aylik';if(/sefer|is basi/.test(text))return'is_basi';if(/teklif/.test(text))return'teklif';return text};
const budgetAmount=raw=>{const m=String(raw||'').match(/(?:₺\s*(\d[\d., ]{0,15})|(\d[\d., ]{0,15})\s*(?:₺|tl|lira)\b)/i);if(!m)return null;const n=Number((m[1]||m[2]).replace(/[^0-9]/g,''));return Number.isSafeInteger(n)&&n>0?n:null};
const tonnage=text=>{const m=text.match(/\b(\d{1,4})\s*ton(?:luk)?\b/);return m?Number(m[1]):null};
export function searchIntent(question,history=[]){
 const current=normalize(question),previous=history.map(x=>normalize(x.content)).reverse(),tokens=current.split(' ').filter(Boolean);
 const currentPlace=resolvePlace(question),priorPlaces=previous.map(resolvePlace),priorPlace=priorPlaces.find(x=>x.city||x.district)||{city:'',district:''};
 const place=currentPlace.city||currentPlace.district||currentPlace.ambiguous||currentPlace.unknown?currentPlace:priorPlace;
 const currentCategory=categoryOf(current),priorCategories=previous.map(categoryOf),priorCategory=priorCategories.find(x=>x.category||x.ambiguous)||{category:'',ambiguous:false,categories:[]};
 const category=currentCategory.category||(!currentCategory.ambiguous?priorCategory.category:'');
 const currentHasCategory=currentCategory.category||currentCategory.ambiguous;
 const tons=tonnage(current)??(!currentHasCategory||currentCategory.category===priorCategory.category?previous.map(tonnage).find(x=>x!=null)??null:null);
 const unit=feeUnitOf(current)||(!currentPlace.city&&!currentPlace.district&&!currentPlace.unknown?previous.map(feeUnitOf).find(Boolean)||'':'');
 const amount=budgetAmount(question),budgetRequested=/\b(en fazla|altinda|gecmesin|butce|butcem|ust limit|kadar)\b/.test(current),priorBudget=previous.map(budgetAmount).find(x=>x!=null);
 const maxPrice=amount&&budgetRequested?amount:(!budgetRequested?priorBudget:null);
 const terms=tokens.filter(x=>x.length>2&&!STOP.has(x)&&!categoryWords.has(x)&&!/^\d+$/.test(x)&&!['saatlik','gunluk','aylik','seferlik','teklif','tl','lira'].includes(x)&&!matchesLocationToken(x));
 return{category,categoryAmbiguous:currentCategory.ambiguous||(!currentHasCategory&&priorCategory.ambiguous),categories:currentCategory.category||currentCategory.ambiguous?currentCategory.categories:priorCategory.categories||[],city:place.city||'',district:place.district||'',locationAmbiguous:Boolean(place.ambiguous),unknownLocation:Boolean(place.unknown),locationCorrected:Boolean(place.corrected),categoryCorrected:Boolean(currentCategory.corrected),tons,unit,maxPrice,cheapest:/\b(ucuz|ekonomik)\b|fiyata gore/.test(current)||previous.some(x=>/\b(ucuz|ekonomik)\b|fiyata gore/.test(x)),terms};
}
function matchesLocationToken(token){return placeByKey.has(token)||Boolean(stripCaseSuffix(token)!==token&&placeByKey.has(stripCaseSuffix(token)))}
export function rankAssistantListings(items,intent){
 const eligible=items.filter(x=>(!intent.category||x.category===intent.category)&&(!intent.city||normalize(x.city)===normalize(intent.city))&&(!intent.district||normalize(x.district)===normalize(intent.district))&&(!intent.unit||canonicalUnit(x.price_unit)===intent.unit)&&(!intent.maxPrice||(Number(x.price_amount)>0&&Number(x.price_amount)<=intent.maxPrice)));
 const comparable=intent.cheapest&&eligible.length>0&&eligible.every(x=>Number(x.price_amount)>0&&x.price_unit&&canonicalUnit(x.price_unit)===canonicalUnit(eligible[0].price_unit));
 return eligible.map(item=>{const title=normalize(item.title),body=normalize(item.description),place=normalize(item.city+' '+item.district),capacities=[...normalize(item.title+' '+item.description).matchAll(/\b(\d{1,4})\s*ton(?:luk)?\b/g)].map(x=>Number(x[1]));if(intent.tons!=null&&!capacities.includes(intent.tons))return null;const score=intent.terms.reduce((n,t)=>n+(contains(title,t)?4:contains(place,t)?3:contains(body,t)?1:0),0);return{item,score}}).filter(Boolean).sort((a,b)=>comparable?(Number(a.item.price_amount)-Number(b.item.price_amount)||b.score-a.score):(b.score-a.score||Number(b.item.created_at||0)-Number(a.item.created_at||0))).slice(0,3).map(({item:x})=>({id:x.id,title:redactForAI(String(x.title||'')).slice(0,120),category:x.category,city:x.city,district:x.district,price_amount:x.price_amount,price_unit:x.price_unit,contact_phone:x.contact_phone||'',photo_url:x.photo_url||'',package_tier:x.package_tier||'standard'}));
}
export function assistantFallback(items,intent){
 if(!items.length){const criteria=[intent.district,intent.city,intent.tons?intent.tons+' ton':'',intent.unit==='is_basi'?'iş başı':intent.unit==='saatlik'?'saatlik':intent.unit==='gunluk'?'günlük':intent.unit==='aylik'?'aylık':''].filter(Boolean);return(criteria.length?criteria.join(' · ')+' ölçütlerinde ':'')+'onaylı ilan bulamadım. Başka bir şehir veya ekipmanla arayabilirsin.';}
 return(items.length===1?'Aramana uyan 1 onaylı ilan buldum.':'Aramana uyan '+items.length+' onaylı ilan buldum.')+' Müsaitlik ve kapsamı ilan sahibiyle teyit et.';
}
export function categoryLabel(category){return categoryLabels[category]||'ekipman'}
export function siteHelp(question){
 const text=normalize(question);
 if(/(ara|arama|filtre|bul)/.test(text)&&/\b(nasil|nerede|kullan\w*|ac|sec)\b/.test(text))return'Menüyü açıp önce kategoriyi seç; ardından şehir/ilçe ve diğer filtreleri belirleyip Filtrele’ye dokun.';
 if(/(gizlilik|guvenlik|telefon|eposta|e posta|kisisel bilgi)/.test(text))return'YükUsta yalnızca yayındaki ilanları bulur; hesap, ilan veya fiyat değişikliği yapamaz. Sohbette telefon, e-posta veya parola paylaşma. Ayrıntılar için Gizlilik ve aydınlatma sayfasını inceleyebilirsin.';
 if(/nedir|ne ise yarar|farki|nasil sec/.test(text)){const kind=categoryOf(text).category,guides={crane:'Vinç, yük kaldırma ve konumlandırmada kullanılır. Yük ağırlığı, kaldırma yüksekliği, çalışma mesafesi ve zemin koşullarını yetkili operatöre teyit ettir.',basket:'Sepetli platform, personelin yüksekte çalışmasına erişim sağlar. Çalışma yüksekliği, yatay erişim ve zemin koşullarını belirt.',manlift:'Manlift, yüksekte çalışma erişimi için kullanılan makaslı veya eklemli platformdur. Gereken çalışma yüksekliği ve alanı belirt.',tow:'Çekici ve yol yardım ararken araç türü, durumu ve bulunduğu konumu ilan sahibine ilet.',lift:'Nakliyat asansörü yük/eşya taşımak içindir. Yük ölçülerini, katı ve kurulum alanını teyit et; insan taşımaya uygun varsayma.',machine:'İş makinesi seçiminde yapılacak iş, zemin ve gereken erişim/kapasite belirleyicidir.',operator:'Operatör ilanlarında deneyim ve belgeleri işverenle doğrula.'};if(guides[kind])return guides[kind]}
 if(/fotograf|gorsel|resim/.test(text)&&/yukle|ekle|boyut|kac|gozuk|gorun|bozuk/.test(text))return'İlanına JPEG, PNG veya WebP biçiminde en fazla 3 fotoğraf ekleyebilirsin. Onaylanıp yayına alındığında herkese görünür. Sorun devam ederse İletişim sayfasından bildir.';
 if(/ilan/.test(text)&&/nasil.*(ver|ekle|olustur)|nasil.*yayinla|ilan vermek/.test(text))return'İlan vermek için üye girişi yapıp “İlan ver” sayfasını aç. Kategori, il ve ilçe seç; başlık, açıklama, ücret türü ve fotoğrafları ekleyip gönder. Yayın öncesi yönetici incelemesi yapılır.';
 if(/ilan/.test(text)&&/onay|bekli|yayinlanm/.test(text))return'İlanlar yayınlanmadan önce yönetici incelemesinden geçer. İlan durumunu Hesabım bölümünden görebilirsin.';
 if(/^(merhaba|selam|iyi gunler|ne yapabilirsin|yardim)$/.test(text))return'Merhaba, ben YükUsta. Vinç, çekici/yol yardımı, manlift ve diğer ilanları şehir/ilçeye göre bulabilirim. Hangi şehirde, ne arıyorsun?';
 return'';
}











