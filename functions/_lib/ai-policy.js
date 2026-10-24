export const AI_RATE_LIMIT_ACTION='ai';
export const SUPPORT_RATE_LIMIT_ACTION='report';
export const AI_LIMITS={dailyCalls:500,perIpCalls:5,perIpWindowSeconds:900,maxQuestionLength:600,maxAnswerLength:1200};
const fold=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/\p{Diacritic}/gu,'');
const PRICE_REQUEST=/\b(fiyat|ucret|indirim|kampanya|bedava|ucretsiz|paket|premium|standart|odeme|abonelik|sozlesme)\b/;
const CRITICAL_REQUEST=/\b(onayla|reddet|sil|engelle|one cikar|paket\w* ata|yayina al)\b/;
export function classifyAssistantRequest(value){const text=fold(String(value||'').slice(0,AI_LIMITS.maxQuestionLength));if(PRICE_REQUEST.test(text))return'pricing';if(CRITICAL_REQUEST.test(text))return'admin_action';return'read_only'}
export function validateAssistantOutput(value,requestKind='read_only'){
 if(requestKind==='pricing')return{ok:true,response:'Fiyat, indirim ve paket işlemlerini ben değiştiremiyorum. Talebini yöneticimize iletiyorum; yönetici yanıtı admin panelinden takip edebilir.'};
 if(requestKind==='admin_action')return{ok:true,response:'Bu işlem için yönetici onayı gerekiyor. Ben ilan veya hesap üzerinde değişiklik yapamam; talebini yöneticiye iletebilirim.'};
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.response!=='string')return{ok:false,response:''};
 const response=value.response.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').trim().slice(0,AI_LIMITS.maxAnswerLength);if(!response)return{ok:false,response:''};
 const safe=fold(response);if(/(?:sana|size) (?:indirim|ucretsiz paket|bedava paket) (?:verdim|tanimladim)|fiyati (?:degistirdim|dusurdum)|ilani (?:onayladim|reddettim|sildim)|hesabi (?:engelledim|kapattim)/.test(safe))return{ok:false,response:''};
 return{ok:true,response};
}
export function aiConversationId(value){return/^[A-Za-z0-9_-]{8,80}$/.test(String(value||''))?String(value):crypto.randomUUID().replaceAll('-','')}
