import {redactForAI,turkishCities} from './listings.js';

export const foldSearch=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const CATEGORY_TERMS={operator:['operator','is ariyorum','is arayan'],basket:['sepetli','platform'],lift:['nakliyat asansoru','yuk asansoru','esya asansoru'],tow:['cekici','kurtarici','yol yardim'],machine:['is makinesi','forklift','kepce','ekskavator','beko','loder'],crane:['vinc','hiyap','hiyab','tonaj']};
const STOP=new Set('ariyorum ariyor bakiyorum lazim istiyorum olan ilan ilani ilanlari bana icin hangi nedir midir ve ile bir en yakin var mi mu bu da de daha goster bul lutfen hizmet kiralama fiyat fiyatli ucuz uygun'.split(' '));
const contains=(text,term)=>(' '+text+' ').includes(' '+term+' ');
const categoryOf=text=>Object.entries(CATEGORY_TERMS).find(([,terms])=>terms.some(term=>contains(text,term)))?.[0]||'';
const cityOf=text=>turkishCities.find(city=>{const name=foldSearch(city);return contains(text,name)||['da','de','ta','te','dan','den','tan','ten'].some(suffix=>contains(text,name+suffix))})||'';
export function cleanAssistantHistory(value){
 return(Array.isArray(value)?value:[]).slice(-4).filter(x=>x&&x.role==='user'&&typeof x.content==='string').map(x=>({role:'user',content:redactForAI(x.content).slice(0,600)}));
}
const DISTRICT_CITY={
 gebze:'Kocaeli',meram:'Konya',karatay:'Konya',selcuklu:'Konya',cankaya:'Ankara',kecioren:'Ankara',kadikoy:'İstanbul',uskudar:'İstanbul',basaksehir:'İstanbul',pendik:'İstanbul',sariyer:'İstanbul',nilufer:'Bursa',osmangazi:'Bursa',bornova:'İzmir',buca:'İzmir',konak:'İzmir',muratpasa:'Antalya',sehitkamil:'Gaziantep',yenimahalle:'Ankara'
};
const districtOf=text=>Object.keys(DISTRICT_CITY).find(name=>contains(text,name)||['da','de','ta','te','dan','den','tan','ten'].some(suffix=>contains(text,name+suffix)))||'';
const feeUnitOf=text=>{
 if(/\b(saatlik|saat basi|saat)\b/.test(text))return'saatlik';
 if(/\b(gunluk|gun basi)\b/.test(text))return'gunluk';
 if(/\b(aylik|ay)\b/.test(text))return'aylik';
 if(/\b(is basi|sefer basi|seferlik|sefer)\b/.test(text))return'is_basi';
 if(/\b(teklif|fiyat sor)\b/.test(text))return'teklif';
 return'';
};
export const canonicalUnit=value=>{
 const text=foldSearch(value);
 if(/saat/.test(text))return'saatlik';
 if(/gun/.test(text))return'gunluk';
 if(/ay/.test(text))return'aylik';
 if(/sefer|is basi/.test(text))return'is_basi';
 if(/teklif/.test(text))return'teklif';
 return text;
};
const budgetAmount=raw=>{
 const match=String(raw||'').match(/(?:₺\s*(\d[\d., ]{0,15})|(\d[\d., ]{0,15})\s*(?:₺|tl|lira)\b)/i);
 if(!match)return null;
 const amount=Number((match[1]||match[2]).replace(/[^0-9]/g,''));
 return Number.isSafeInteger(amount)&&amount>0?amount:null;
};
export function searchIntent(question,history=[]){
 const current=foldSearch(question),previous=history.map(x=>foldSearch(x.content)).reverse();
 const currentDistrict=districtOf(current),currentCity=cityOf(current),priorDistrict=previous.map(districtOf).find(Boolean)||'';
 const district=currentDistrict||(currentCity?'':priorDistrict);
 const city=currentCity||(district?DISTRICT_CITY[district]:previous.map(cityOf).find(Boolean))||'';
 const currentCategory=categoryOf(current),priorCategory=previous.map(categoryOf).find(Boolean)||'',category=currentCategory||priorCategory;
 const tonnage=text=>{const m=text.match(/\b(\d{1,4})\s*ton(?:luk)?\b/);return m?Number(m[1]):null};
 const priorTons=previous.map(tonnage).find(value=>value!=null),tons=tonnage(current)??(!currentCategory||currentCategory===priorCategory?priorTons:null);
 const unit=feeUnitOf(current)||previous.map(feeUnitOf).find(Boolean)||'';
 const amount=budgetAmount(question),budgetRequested=/\b(en fazla|altinda|gecmesin|butce|butcem|ust limit|kadar)\b/.test(current),priorBudget=previous.map(budgetAmount).find(value=>value!=null);
 const maxPrice=amount&&budgetRequested?amount:(!budgetRequested?priorBudget:null);
 const terms=current.split(' ').filter(x=>x.length>2&&!STOP.has(x)&&!/^\d+$/.test(x)&&!['saatlik','gunluk','aylik','seferlik','teklif','tl','lira'].includes(x));
 return{category,city,district,tons,unit,maxPrice,cheapest:/\b(ucuz|ekonomik)\b|fiyata gore/.test(current)||previous.some(text=>/\b(ucuz|ekonomik)\b|fiyata gore/.test(text)),terms};
}
export function rankAssistantListings(items,intent){
 const eligible=items.filter(x=>(!intent.category||x.category===intent.category)&&(!intent.city||foldSearch(x.city)===foldSearch(intent.city))&&(!intent.district||foldSearch(x.district)===foldSearch(intent.district))&&(!intent.unit||canonicalUnit(x.price_unit)===intent.unit)&&(!intent.maxPrice||(Number(x.price_amount)>0&&Number(x.price_amount)<=intent.maxPrice)));
 const comparable=intent.cheapest&&eligible.length>0&&eligible.every(x=>x.price_amount>0&&x.price_unit&&canonicalUnit(x.price_unit)===canonicalUnit(eligible[0].price_unit));
 return eligible.map(item=>{
  const title=foldSearch(item.title),body=foldSearch(item.description),place=foldSearch(item.city+' '+item.district);
  const capacities=[...foldSearch(item.title+' '+item.description).matchAll(/\b(\d{1,4})\s*ton(?:luk)?\b/g)].map(x=>Number(x[1]));
  if(intent.tons!=null&&!capacities.includes(intent.tons))return null;
  const score=intent.terms.reduce((n,t)=>n+(contains(title,t)?4:contains(place,t)?3:contains(body,t)?1:0),0);
  return{item,score};
 }).filter(Boolean).sort((a,b)=>{
  if(comparable)return a.item.price_amount-b.item.price_amount||b.score-a.score;
  return b.score-a.score||Number(b.item.created_at||0)-Number(a.item.created_at||0);
 }).slice(0,5).map(({item:x})=>({id:x.id,title:redactForAI(String(x.title||'')).slice(0,120),category:x.category,city:x.city,district:x.district,price_amount:x.price_amount,price_unit:x.price_unit,package_tier:x.package_tier||'standard',description:redactForAI(String(x.description||'')).slice(0,280)}));
}
export function assistantFallback(items,intent){
 if(!items.length)return(intent.city?intent.city+' için ':'')+(intent.tons?intent.tons+' ton kapasiteye uyan ':'')+'onaylı bir ilan bulamadım. Başka bir şehir veya ekipman türü söyleyebilirsin.';
 return(items.length===1?'Aramana uyan bir onaylı ilan buldum.':'Aramana uyan '+items.length+' onaylı ilan buldum.')+' Aşağıdaki ilanları inceleyebilirsin. Kapasiteyi, fiyat birimini ve müsaitliği ilan sahibiyle teyit et.';
}
export function siteHelp(question){
 const text=foldSearch(question);
 if(/(ara|arama|filtre|bul)/.test(text)&&/(nasil|nerede|kullan|ac|sec)/.test(text))return'Arama ve filtreler menüde. Menüyü açıp önce kategoriyi seç; ardından ilan metnini, şehir/ilçeyi, ücret türünü ve üst sınırı belirleyip Filtrele’ye dokun. Kiralık ve iş başı ilan türünü de aynı menüden seçebilirsin.';
 if(/(gizlilik|guvenlik|telefon|eposta|e posta|kisisel bilgi)/.test(text))return'YükUsta onaylı ilanları arar; hesap, ilan veya fiyat değişikliği yapamaz. Sohbette telefon, e-posta veya parola paylaşma. Sohbet kayıtlarında kişisel bilgiler maskelenir; ayrıntılar için Gizlilik ve aydınlatma sayfasını inceleyebilirsin.';
 if(/nedir|ne ise yarar|farki|nasil sec/.test(text)){
  const kind=categoryOf(text),guides={crane:'Vinç, yük kaldırma ve konumlandırma işlerinde kullanılır. Seçim için yükün ağırlığı, kaldırma yüksekliği, çalışma mesafesi ve zemin koşulları gerekir. İlandaki tonaj tek başına yeterli değildir; uygunluğu yetkili operatörün yük tablosuyla doğrulaması gerekir.',basket:'Sepetli platform, personelin yüksekte çalışması için kullanılır. Çalışma yüksekliği, yatay erişim, platform kapasitesi ve zemin koşullarını ilan sahibine bildir. İşe uygunluk ve güvenli kullanım yetkili ekip tarafından değerlendirilmelidir.',tow:'Oto kurtarıcı ve çekici hizmetinde araç türü, yaklaşık ağırlığı, aracın durumu ve alınacağı konum önemlidir. Hizmet kapsamını, ulaşım süresini ve toplam ücreti hizmet sağlayıcıyla teyit et.',lift:'Nakliyat asansörü eşya ve yük taşımada kullanılır. Kat/yükseklik, kurulum alanı, yük ölçüleri ve taşıma kapasitesini ilan sahibiyle görüş. İnsan taşımaya uygun olduğunu varsayma.',machine:'İş makinesi seçiminde yapılacak iş, zemin, alan ölçüleri ve gereken erişim/kapasite belirleyicidir. Forklift, kepçe ve ekskavatör farklı işler içindir; işi anlatırsan şehir ve ekipman türüne göre ilan aramana yardım edebilirim.',operator:'Operatör ilanları iş arayan kişilerin ilanlarıdır. Deneyim, kullanılan ekipman ve gerekli belgeler işveren tarafından doğrulanmalıdır. YükUsta belge veya yetkinlik doğrulaması yapmaz.'};
  if(guides[kind])return guides[kind];
 }
 if(/fotograf|gorsel|resim/.test(text)&&/yukle|ekle|boyut|kac|gozuk|gorun|bozuk/.test(text))return'İlanına JPEG, PNG veya WebP biçiminde en fazla 3 fotoğraf ekleyebilirsin. İlan formu fotoğrafları otomatik küçültür. Fotoğraflar ilan onaylanıp yayına alındığında herkese görünür. Sorun devam ederse bu sohbetin destek bölümünden bildir.';
 if(/ilan/.test(text)&&/nasil.*(ver|ekle|olustur)|nasil.*yayinla|ilan vermek/.test(text))return'Üye girişi yapıp “İlan ver” bölümünü aç. Kategori, il ve ilçe seç; açıklama, iletişim ve fotoğrafları ekleyip gönder. İlan güvenlik kontrolünden ve yönetici incelemesinden sonra yayımlanır. Operatör iş arayışı ilanında fiyat girilmez.';
 if(/ilan/.test(text)&&/onay|bekli|yayinlanm|yayinlanmad/.test(text))return'Yeni ilanlar yönetici onayı bekler. YükUsta metin, fotoğraf ve tekrar ilan belirtilerini inceler; şüpheli bulguları yöneticiye gösterir. Son kararı yönetici verir. Kendi ilanının durumunu üye panelinden görebilirsin.';
 if(/^(merhaba|selam|iyi gunler|ne yapabilirsin|yardim)$/.test(text))return'Merhaba, ben YükUsta. Şehir, ekipman ve kapasiteye göre yayındaki ilanları bulmana yardımcı olurum. Örneğin “Ankara’da 50 ton vinç arıyorum” yazabilirsin. İlan verme ve fotoğraf yükleme sorularını da yanıtlayabilirim.';
 return'';
}

