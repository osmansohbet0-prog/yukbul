export function radarServiceCategory(service){
 const t=String(service||'').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(/mobil lastik|lastikci/.test(t))return 'mobile_tire';
 if(/oto kurtar|yol yardim|arac kurtar/.test(t))return 'tow';
 if(/nakliyat asansor|esya asansor|yuk asansor/.test(t))return 'lift';
 if(/sepetli/.test(t))return 'basket';
 if(/manlift|platform/.test(t))return 'manlift';
 if(/is makine|kepce|ekskavator|forklift|yukleyici|greyder|silindir|telehandler/.test(t))return 'machine';
 if(/vinc|kaldirma/.test(t))return 'crane';
 return 'unknown';
}
