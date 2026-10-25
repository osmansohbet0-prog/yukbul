export const categoryPaths = {crane:'vinc',mobile_tire:'mobil-lastikci',tow:'oto-kurtarici',basket:'sepetli-platform',manlift:'manlift',machine:'is-makinesi',lift:'nakliyat-asansoru',operator:'operator-is-ilanlari'};
export const categoryNames = {crane:'Vinç kiralama',mobile_tire:'Mobil lastikçi',tow:'Oto kurtarıcı ve yol yardım',basket:'Sepetli platform',manlift:'Manlift kiralama',machine:'İş makinesi ve forklift',lift:'Nakliyat asansörü',operator:'Operatör iş ilanları'};
export const escapeHtml = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const citySlug = value => String(value||'').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const iconTags = '<link rel="icon" href="/assets/yuk-vinc-favicon.png" type="image/png" sizes="96x96"><link rel="apple-touch-icon" href="/assets/yuk-vinc-logo-192.png" sizes="192x192">';
const guides = {
 crane:'Vinç seçerken yükün ağırlığını, kaldırma yüksekliğini ve çalışma mesafesini belirtin. Saatlik veya günlük ücrete operatör, ulaşım ve kurulumun dahil olup olmadığını ilan sahibinden öğrenin.',
 mobile_tire:'Lastik ölçüsünü, araç türünü ve bulunduğunuz konumu paylaşın. Yerinde tamirin mümkün olup olmadığını; servis gelişi, işçilik ve yeni lastik bedelini ayrı ayrı sorun.',
 tow:'Araç türünü, aracın hareket edip etmediğini ve alınacağı/bırakılacağı konumu belirtin. Kilometre, yükleme koşulları ve ek hizmetlerin toplam ücrete etkisini sorun.',
 basket:'Çalışma yüksekliğini, yatay erişim mesafesini ve zemin koşullarını belirtin. Platform kapasitesini, operatör ihtiyacını ve kurulum alanını hizmet sağlayıcıyla değerlendirin.',
 manlift:'İç veya dış mekânı, çalışma yüksekliğini, platform kapasitesini ve zemin koşullarını belirtin. Makaslı veya eklemli platform seçimini ve nakliye bedelini ilan sahibiyle netleştirin.',
 machine:'Yapılacak işi, yük ağırlığını ve çalışma alanını açıklayın. Ekipmanın kapasitesini; kiralama süresini, operatör, yakıt ve nakliye bedellerini ayrı ayrı sorun.',
 lift:'Taşınacak eşyanın ölçülerini, kat yüksekliğini ve binaya yaklaşma koşullarını belirtin. Kurulum alanını, çalışma süresini ve toplam hizmet bedelini ilan sahibiyle netleştirin.',
 operator:'Kullanılacak makineyi, işin konumunu ve çalışma saatlerini belirtin. Operatörün ilgili ekipman deneyimini, gerekli belgelerini ve ücret beklentisini doğrudan görüşün.'
};
export function categoryGuide(key){return '<section aria-label="İlanları değerlendirme rehberi"><h2>'+escapeHtml(categoryNames[key]||'İlan')+' için nelere dikkat edilmeli?</h2><p>'+escapeHtml(guides[key]||'Hizmet kapsamını ve toplam ücreti ilan sahibiyle doğrulayın.')+'</p></section>'}
export function cityLinks(rows){const cities=[...new Set(rows.map(x=>x.city).filter(Boolean))];return cities.length?'<nav aria-label="İlan bulunan şehirler"><h2>İlan bulunan şehirler</h2><p>'+cities.map(city=>'<a href="/sehir/'+citySlug(city)+'/">'+escapeHtml(city)+' ilanları</a>').join(' · ')+'</p></nav>':''}
export function categoryLinks(rows){const keys=[...new Set(rows.map(x=>x.category))].filter(key=>categoryPaths[key]);return keys.length?'<nav aria-label="İlan bulunan kategoriler"><p>'+keys.map(key=>'<a href="/kategori/'+categoryPaths[key]+'/">'+escapeHtml(categoryNames[key])+'</a>').join(' · ')+'</p></nav>':''}
