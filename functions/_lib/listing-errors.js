const MESSAGES = {
  DB_BINDING_MISSING: 'İlan hizmeti şu an hazır değil. Lütfen daha sonra tekrar dene.',
  TABLE_MISSING: 'İlan sistemi kurulumu eksik. Lütfen site yöneticisine bildir.',
  COLUMN_MISSING: 'İlan sistemi güncellemesi eksik. Lütfen site yöneticisine bildir.',
  SCHEMA_MISMATCH: 'İlan sistemi veritabanı güncellemesi gerekiyor. Lütfen site yöneticisine bildir.',
  STORAGE_BINDING_MISSING: 'Fotoğraf depolama hizmeti bağlı değil. Lütfen site yöneticisine bildir.',
  VALIDATION_FAILED: 'Zorunlu alanları kontrol et.',
  CITY_INVALID: 'Listeden geçerli bir il seç.',
  PHOTO_TOO_LARGE: 'Fotoğraf çok büyük. Daha küçük bir fotoğraf seçip yeniden dene.',
  PHOTO_TYPE_INVALID: 'Fotoğraf biçimi desteklenmiyor. JPG, PNG veya WebP kullan.',
  AUTH_REQUIRED: 'İlan vermek için önce hesabına giriş yap.',
  RATE_LIMIT: 'Çok kısa sürede fazla ilan denemesi yaptın. Bir süre sonra tekrar dene.',
  AI_UNAVAILABLE: 'Otomatik içerik kontrolü geçici olarak kullanılamıyor.',
  REQUEST_TOO_LARGE: 'Form veya fotoğraf gönderimi çok büyük. Fotoğrafı yeniden seçip dene.',
  DUPLICATE_LISTING: 'Aynı içerikle yakın zamanda ilan verilmiş.',
  UNKNOWN: 'İlan kaydedilemedi. Biraz sonra tekrar dene.'
};
function errorCode(error) {
  const m=String(error?.message||error||'');
  if(/too large|body.*large|request.*size|limit.*body|413/i.test(m))return 'REQUEST_TOO_LARGE';
  if(/UNIQUE|unique constraint/i.test(m))return 'DUPLICATE_LISTING';
  if(/no such table|table .* does not exist/i.test(m))return 'TABLE_MISSING';
  if(/no such column|has no column named|column .* does not exist/i.test(m))return 'COLUMN_MISSING';
  if(/CHECK constraint failed/i.test(m))return 'SCHEMA_MISMATCH';
  if(/1,8 MB|1.8 MB|en fazla 1,8/i.test(m))return 'PHOTO_TOO_LARGE';
  if(/Yalnızca JPEG|Dosya türü doğrulanamadı|Görsel verisi bozuk|Yalnızca .* görsel/i.test(m))return 'PHOTO_TYPE_INVALID';
  if(/81 ilden|listeden geçerli bir il/i.test(m))return 'CITY_INVALID';
  if(/Başlık|Açıklama|İlçe|Kategori|Fiyat|telefon|zorunlu|İlan türü|Adres/i.test(m))return 'VALIDATION_FAILED';
  return 'UNKNOWN';
}
export function listingError(code, request, status=400, field) {
  const requestId=request?.headers?.get('cf-ray')||crypto.randomUUID();
  return Response.json({ok:false,code,message:MESSAGES[code]||MESSAGES.UNKNOWN,...(field?{field}:{}),request_id:requestId},{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
export function listingFailure(error, request, phase='save', status=500) {
  const code=errorCode(error), requestId=request?.headers?.get('cf-ray')||crypto.randomUUID();
  console.error('[listing-api]',JSON.stringify({phase,code,request_id:requestId,error:String(error?.message||error),stack:error?.stack}));
  const field=code==='CITY_INVALID'?'city':code==='PHOTO_TOO_LARGE'||code==='PHOTO_TYPE_INVALID'?'photos':undefined;
  return listingError(code,request,status,field);
}
