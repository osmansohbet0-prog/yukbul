export const DEFAULT_WEIGHTS = Object.freeze({category:30,capacity:30,location:20,technical:15,deadline:5});
const units = ['bir','iki','uc','dort','bes','alti','yedi','sekiz','dokuz'];
const tens = ['on','yirmi','otuz','kirk','elli','altmis','yetmis','seksen','doksan'];
const numberWords = [...units,...tens,'yuz','bin'];
const folded = value => String(value ?? '').toLocaleLowerCase('tr').normalize('NFD').replace(/\p{M}/gu,'').replace(/ı/g,'i');
const decimal = value => /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(value)
  ? Number(value.replaceAll('.','').replace(',','.'))
  : Number(value.replace(',','.'));

function wordsToNumber(values){
  let total=0,current=0,previous=-1;
  for(const word of values){
    if(word==='bin'){if(previous===3)return null;total+=(current||1)*1000;current=0;previous=3;continue}
    if(word==='yuz'){if(current>9||previous===2)return null;current=(current||1)*100;previous=2;continue}
    const rank=tens.indexOf(word),unit=units.indexOf(word);
    if(rank>=0){if(previous===1||previous===0)return null;current+=(rank+1)*10;previous=1}
    else if(unit>=0){if(previous===0)return null;current+=unit+1;previous=0}
  }
  return total+current || null;
}

export function capacities(text){
  const value=folded(text).slice(0,24000);
  const words=numberWords.join('|');
  const amount='(?:\\d+(?:[.,]\\d+)*|(?:'+words+')(?:\\s+(?:'+words+')){0,5})';
  const pattern=new RegExp('(?<![\\p{L}\\p{N}])('+amount+')\\s*(?:[-–—]\\s*('+amount+')\\s*)?(ton(?:luk|luklu)?|kg|kilogram|t)(?![\\p{L}\\p{N}])','gu');
  const parse=raw=>/^\d/.test(raw)?decimal(raw):wordsToNumber(raw.split(/\s+/));
  return [...value.matchAll(pattern)].flatMap(match=>{
    const unit=['kg','kilogram'].includes(match[3])?1000:1;
    const first=parse(match[1])/unit,last=match[2]?parse(match[2])/unit:first;
    if(!(first>0&&last>=first&&last<=10000))return [];
    return [{minimum:first,maximum:last,index:match.index,length:match[0].length}];
  });
}

const patterns = [
  ['basket',/\b(?:sepetli (?:vinc|platform)|sepetli|personel yukseltici)\b/],
  ['manlift',/\b(?:manlift|makasli platform|eklemli platform)\b/],
  ['lift',/\b(?:nakliyat asansoru|tasima asansoru|mobil asansor)\b/],
  ['tow',/\b(?:oto kurtarici|oto kurtarma|cekici hizmeti)\b/],
  ['mobile_tire',/\b(?:mobil lastik|yerinde lastik)\b/],
  ['crane',/\b(?:vinc|crane)\b/],
  ['machine',/\b(?:is makinesi|ekskavator|kazici|yukleyici|forklift|kepce)\b/]
];
const knownCategories=new Set(patterns.map(([category])=>category));
const kinds=[['mobil',/\bmobil vinc\b/],['hiyap',/\b(?:hiyap|hiab)\b/],['kule',/\bkule vinc(?:i)?\b/],['forklift',/\bforklift\b/],['ekskavatör',/\bekskavator\b/],['kepçe',/\bkepce\b/]];
const detect = (patterns,text) => patterns.find(([,rule])=>rule.test(text))?.[0]??null;
const nonempty = value => typeof value==='string'&&value.trim()?value.trim():null;
const numeric = value => Number.isFinite(value)&&value>0?value:null;
const metric = (text,label) => {
  const found=text.match(new RegExp('(?:'+label+')\\s*(?:en az\\s*|min(?:imum)?\\s*)?[:=]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:m|metre)\\b'));
  return found?numeric(decimal(found[1])):null;
};
function equipment(text,fallback){
  const mentions=patterns.filter(([,rule])=>rule.test(text)).map(([category])=>category);
  const categories=mentions.includes('basket')?mentions.filter(category=>category!=='crane'):mentions;
  return {category:categories.length===1?categories[0]:knownCategories.has(fallback)&&!categories.length?fallback:null,categoryAmbiguous:categories.length>1};
}

export function listingProfile(row){
  const text=folded([row.title,row.description].filter(Boolean).join('\n'));
  const measurements=capacities(text);
  const distinct=[...new Map(measurements.map(x=>[x.minimum+'/'+x.maximum,x])).values()];
  const specification=distinct.length===1?distinct[0]:null;
  const service=text.match(/\bhizmet bolgesi\s*:\s*([^\n;.]{1,180})/);
  return {
    id:row.id,title:row.title,category:knownCategories.has(row.category)?row.category:equipment(text).category,
    type:detect(kinds,text),minimum:specification?.minimum??null,maximum:specification?.maximum??null,
    brand:nonempty(text.match(/\bmarka\s*:\s*([^\n,;]{1,45})/)?.[1]),
    model:nonempty(text.match(/\bmodel\s*:\s*([^\n,;]{1,45})/)?.[1]),
    boom:metric(text,'bom(?: uzunlugu)?'),height:metric(text,'(?:calisma|erisim) yuksekligi'),
    modelYear:numeric(Number(text.match(/\b(19\d{2}|20\d{2})\s*model\b/)?.[1])),
    operator:/\boperator(?:lu| dahil)\b/.test(text)?true:/\boperator(?:suz| haric)\b/.test(text)?false:null,
    city:nonempty(row.city),district:nonempty(row.district),serviceArea:nonempty(service?.[1]),
    workType:nonempty(row.price_unit),active:row.active===true
  };
}

function capacityRequirement(text){
  const matches=capacities(text).map(measurement=>{
    const prefix=text.slice(Math.max(0,measurement.index-36),measurement.index);
    const suffix=text.slice(measurement.index+measurement.length,measurement.index+measurement.length+32);
    const minimum=/\b(?:en az|min(?:imum)?|asgari)\s*[:=]?\s*$/.test(prefix)||/^\s*(?:ve uzeri|minimum|ve ustu|altinda olamaz)\b/.test(suffix);
    const exact=/\b(?:tam|kesin|yalnizca)\s*[:=]?\s*$/.test(prefix)||/^\s*(?:olmalidir|zorunludur)\b/.test(suffix)&&!minimum;
    const maximum=/\b(?:en fazla|azami|maksimum)\s*[:=]?\s*$/.test(prefix);
    return {...measurement,kind:maximum?'maximum':minimum?'minimum':exact?'exact':measurement.minimum!==measurement.maximum?'range':'stated'};
  });
  const distinct=[...new Map(matches.map(x=>[x.minimum+'/'+x.maximum+'/'+x.kind,x])).values()]
    .filter(x=>x.kind!=='stated'||!matches.some(y=>y.kind!=='stated'&&x.minimum===y.minimum&&x.maximum===y.maximum));
  return {capacity:distinct.length===1?distinct[0]:null,capacityAmbiguous:distinct.length>1};
}

export function tenderRequirements(row){
  const text=folded([row.title,row.public_summary,row.source_excerpt].filter(Boolean).join('\n'));
  const closest=(rule)=>nonempty(text.match(rule)?.[1]);
  return {
    ...equipment(text,row.service_type),...capacityRequirement(text),type:detect(kinds,text),
    height:metric(text,'(?:calisma|erisim) yuksekligi'),boom:metric(text,'bom(?: uzunlugu)?'),
    radius:metric(text,'(?:calisma|yuk) yaricapi'),loadChart:/\byuk (?:diyagrami|cetveli|tablosu)\b/.test(text),
    minimumYear:numeric(Number(closest(/(?:en az|minimum)\s+(19\d{2}|20\d{2})\s+model/)??closest(/(19\d{2}|20\d{2})\s+model ve (?:uzeri|ustu)/))),
    operator:/\boperatorlu\b|operator (?:zorunlu|sarti|dahil)/.test(text)?true:null,
    quantity:numeric(Number(closest(/\b(\d+)\s+adet\b/))),
    city:nonempty(row.city),district:nonempty(row.district),deadline:Number(row.public_expires_at)||null,
    scheduled:closest(/ihale tarihi\s*:\s*([^\n;]{4,65})/),
    duration:closest(/(?:is suresi|sozlesme suresi)\s*:\s*([^\n;]{2,85})/),
    hours:closest(/calisma saatleri\s*:\s*([^\n;]{2,85})/),
    documents:closest(/(?:gerekli belgeler|istenen belgeler)\s*:\s*([^\n]{3,350})/),
    qualifications:closest(/(?:yeterlilik kosullari|ozel yeterlilik)\s*:\s*([^\n]{3,350})/)
  };
}

const cap = (value,min,max)=>Math.max(min,Math.min(max,value));
export function matchTender(machine,requirement,{now=Math.floor(Date.now()/1000),weights=DEFAULT_WEIGHTS}={}){
  const w={...DEFAULT_WEIGHTS,...weights};
  if(Object.values(w).some(x=>!Number.isFinite(x)||x<0)||Object.values(w).reduce((a,b)=>a+b,0)!==100)throw Error('Puan ağırlıkları 100 olmalı.');
  const reasons=[],missing=[],blocked=[];
  let score=0;
  if(!machine.active||!requirement.deadline||requirement.deadline<=now)return {score:0,recommended:false,blocked:['Yayında değil veya kapanmış.'],reasons,missing};
  if(requirement.categoryAmbiguous||!requirement.category||!machine.category)missing.push('Makine kategorisi doğrulanamadı.');
  else if(requirement.category!==machine.category)blocked.push('Makine kategorisi farklı.');
  else {score+=w.category;reasons.push('Makine kategorisi eşleşiyor.')}
  if(requirement.type&&machine.type&&requirement.type!==machine.type)blocked.push('Makinenin alt türü farklı.');
  else if(requirement.type&&!machine.type)missing.push('Makinenin alt türü doğrulanamadı.');
  const required=requirement.capacity;
  if(!required||requirement.capacityAmbiguous||machine.minimum===null)missing.push('Tonaj şartı veya makine kapasitesi doğrulanamadı.');
  else if(required.kind==='exact'){
    if(machine.minimum===machine.maximum&&machine.maximum!==required.minimum)blocked.push('Kesin tonaj şartı karşılanmıyor.');
    else if(machine.minimum!==machine.maximum)missing.push('Kesin tonaj makine belgesiyle doğrulanmalı.');
    else{score+=w.capacity;reasons.push('Kesin tonaj eşleşiyor.')}
  }else if(required.kind==='minimum'){
    if(machine.maximum<required.minimum)blocked.push('Makine asgari tonajın altında.');
    else if(machine.minimum<required.minimum)missing.push('Makinenin asgari kapasitesi doğrulanmalı.');
    else{score+=w.capacity;reasons.push('Beyan edilen kapasite asgari tonajı karşılıyor.')}
  }else if(required.kind==='maximum'||required.kind==='range'){
    if(machine.minimum>required.maximum||(required.kind==='range'&&machine.maximum<required.minimum))blocked.push('Kapasite istenen sınırın dışında.');
    else missing.push('Kapasite aralığı şartnameden doğrulanmalı.');
  }else{
    if(machine.maximum<required.minimum)blocked.push('Makine belirtilen tonajın altında.');
    else {score+=w.capacity/2;missing.push('Belirtilen tonajın asgari mi kesin mi olduğu doğrulanmalı.')}
  }
  if(machine.city&&requirement.city&&folded(machine.city)===folded(requirement.city)){
    score+=w.location;reasons.push('İş ve makine aynı ilde.');
  }else if(requirement.city&&machine.serviceArea?.split(/[,/]/).some(city=>folded(city.trim())===folded(requirement.city))){
    score+=w.location;reasons.push('İş, beyan edilen hizmet bölgesinde.');
  }else missing.push('İş konumu veya hizmet bölgesi doğrulanmalı.');
  const checks=[['height','Çalışma yüksekliği'],['boom','Bom uzunluğu'],['minimumYear','Model yılı'],['operator','Operatör şartı']];
  let technicalPassed=0,technicalRequired=0;
  for(const [key,label] of checks){
    if(requirement[key]===null)continue;
    technicalRequired++;
    const actual=machine[key==='minimumYear'?'modelYear':key];
    if(actual===null||actual===undefined)missing.push(label+' doğrulanamadı.');
    else if(key==='operator'?!actual:actual<requirement[key])blocked.push(label+' karşılanmıyor.');
    else technicalPassed++;
  }
  if(requirement.radius||requirement.loadChart){technicalRequired++;missing.push('Çalışma yarıçapı ve yük diyagramı belgeyle kontrol edilmeli.')}
  if(requirement.quantity>1){technicalRequired++;missing.push('İstenen makine adedi ayrıca doğrulanmalı.')}
  if(requirement.qualifications){technicalRequired++;missing.push('Özel yeterlilik belgesi incelenmeli.')}
  if(technicalRequired)score+=w.technical*technicalPassed/technicalRequired;
  else missing.push('Diğer teknik şartlar için resmî doküman kontrol edilmeli.');
  score+=w.deadline;
  score=blocked.length?0:cap(Math.round(score),0,missing.length?74:100);
  return {score,recommended:blocked.length===0&&score>=50,blocked,reasons,missing,band:score>=90?'very_high':score>=75?'high':score>=50?'review':'low'};
}
