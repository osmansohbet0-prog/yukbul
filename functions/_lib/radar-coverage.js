import {PROVINCES} from '../../public/assets/turkey-locations.js';
import {nationalSourceCatalog} from './radar-national-catalog.js';
import {readingAllowed,republicationAllowed} from './radar-ai-review.js';
import {sourceWorkedRecently} from './radar-kocaeli-integration.js';

export const SIGNAL_LAYERS=Object.freeze([
 {id:'direct_demand',label:'Doğrudan kiralama talebi',intentStrength:10,publicDemandCandidate:true,evidence:'Alıcının açık kiralama/teklif isteme ifadesi; kaynak, konum ve güncellik teyidi gerekir.'},
 {id:'tender',label:'Hizmet alımı / ihale',intentStrength:9,publicDemandCandidate:true,evidence:'Mal alımı ayrılır; teklif saati geçmemiş olmalı ve yayın hakkı ayrıca doğrulanır.'},
 {id:'project_indicator',label:'İnşaat / sanayi / enerji projesi',intentStrength:5,publicDemandCandidate:false,evidence:'ÇED, lisans, yatırım veya şantiye haberi yalnız öncü sinyaldir; vinç kiralama ihtiyacı kanıtı değildir.'},
 {id:'recruitment',label:'İşe alım göstergesi',intentStrength:2,publicDemandCandidate:false,evidence:'Operatör ilanı, firmada makine bulunduğuna da işaret edebilir; kiralama talebi sayılmaz.'},
 {id:'company_indicator',label:'Yeni şirket / kurumsal keşif',intentStrength:2,publicDemandCandidate:false,evidence:'Ticaret sicili veya harita kaydı şirketi gösterir; güncel iş talebini göstermez.'},
 {id:'supply',label:'Firma reklamı / satılık ekipman',intentStrength:0,publicDemandCandidate:false,evidence:'Hizmet veren firma ve ekipman satışları talep listesinden elenir.'}
]);
function codesOf(source){try{const values=JSON.parse(source.province_codes_json||'[]');return Array.isArray(values)?[...new Set(values.map(Number))].filter(x=>x>=1&&x<=81):[];}catch{return [];}}
export function buildCoverageMatrix(sources=[],{now=Date.now()}={}){
 const epoch=Math.floor(now/1000),scoped=sources.map(source=>({source,codes:codesOf(source)}));
 const rows=PROVINCES.slice().sort((a,b)=>a.id-b.id).map(province=>{
  const local=scoped.filter(x=>x.codes.includes(province.id)).map(x=>x.source),permitted=local.filter(readingAllowed),working=permitted.filter(x=>sourceWorkedRecently(x,epoch));
  const ready=working.filter(x=>x.source_category==='public_tender'&&republicationAllowed(x,x.feed_url,epoch));
  const blindSpots=[];
  if(!permitted.length)blindSpots.push('permitted_reader_missing');
  if(!working.length)blindSpots.push('working_reader_missing');
  if(!ready.length)blindSpots.push('republication_ready_missing');
  return {provinceCode:province.id,province:province.name,districts:province.districts.length,catalogLinks:nationalSourceCatalog(province.id)?.total||0,registered:local.length,permitted:permitted.length,working:working.length,publicationReady:ready.length,blindSpots};
 });
 return {rows,summary:{provinces:rows.length,districts:rows.reduce((n,x)=>n+x.districts,0),catalogLinks:rows.reduce((n,x)=>n+x.catalogLinks,0),provincesWithoutWorkingReader:rows.filter(x=>!x.working).length,provincesWithoutPublicationReadySource:rows.filter(x=>!x.publicationReady).length,unscopedSources:scoped.filter(x=>!x.codes.length).length},signalLayers:SIGNAL_LAYERS,measuredAt:epoch,note:'Kapsam, kaynak kayıtlarındaki il kodlarından hesaplanır; bir kaynak bağlantısı, ildeki tüm işlerin veya mahallelerin tarandığını kanıtlamaz.'};
}
