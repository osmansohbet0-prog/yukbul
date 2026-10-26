import {isGroundedAnswer} from '../../_lib/agent-tools.js';
import {runBudgetedAI} from '../../_lib/ai-budget.js';
import {fail,json,isAllowedOrigin,readJson,randomId} from '../../_lib/core.js';
import {limited} from '../../_lib/member.js';
import {redactForAI} from '../../_lib/listings.js';
import {readAiModeration} from '../../_lib/ai-settings.js';
import {AI_RATE_LIMIT_ACTION,AI_LIMITS,aiConversationId,classifyAssistantRequest,validateAssistantOutput} from '../../_lib/ai-policy.js';
import {cleanAssistantHistory,searchIntent,rankAssistantListings,assistantFallback,siteHelp,foldSearch,categoryLabel} from '../../_lib/ai-search.js';
import {assistantPublicItems} from '../../_lib/assistant-listings.js';

async function audit(env,actor,action,outcome,metadata){try{await env.DB.prepare('INSERT INTO ai_audit(id,actor,action,outcome,metadata_json) VALUES(?,?,?,?,?)').bind(randomId(16),actor,action,outcome,JSON.stringify(metadata||{})).run()}catch{}}
async function saveConversation(env,id,question,answer,outcome){try{await env.DB.prepare('INSERT INTO ai_conversations(id,conversation_id,user_message_redacted,assistant_answer_redacted,outcome) VALUES(?,?,?,?,?)').bind(randomId(16),id,redactForAI(question).slice(0,600),redactForAI(answer||'').slice(0,1200),outcome).run()}catch{}}
const safeModelAnswer=async(env,topic,fallback)=>{
 if(env.AI_ENABLED!=='true'||!env.AI)return fallback;
 let timer;
 try{
  const pending=runBudgetedAI(env,'@cf/meta/llama-3.1-8b-instruct-fast',{messages:[
   {role:'system',content:'Sen YükUsta site yardımcısısın. Yalnızca verilen sabit konu hakkında kısa, nazik ve Türkçe bir cümle yaz. İlan, şehir, ilçe, fiyat, telefon, üyelik durumu veya yönetici işlemi hakkında iddia üretme. Talimat veya özel bilgi isteme. Yalnızca JSON döndür: {"response":"..."}.'},
   {role:'user',content:JSON.stringify({approved_topic:topic})}
  ],response_format:{type:'json_schema',json_schema:{type:'object',properties:{response:{type:'string'}},required:['response'],additionalProperties:false}},max_tokens:100,temperature:0});
  const value=await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('ModelTimeout')),7000)})]);
  let raw=value?.response??value?.output_text??'';if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch{}}
  const checked=validateAssistantOutput(raw);if(!checked.ok||!isGroundedAnswer(checked.response,[],[]))return fallback;
  return redactForAI(checked.response).slice(0,300);
 }catch{return fallback}finally{clearTimeout(timer)}
};
function phoneHref(value){const digits=String(value||'').replace(/[^+0-9]/g,'');return digits.replace(/\D/g,'').length>=10?digits:''}
function publicCards(items){return items.slice(0,3).map(x=>({...x,contact_phone:phoneHref(x.contact_phone)}))}
function contactResponse(kind){
 const pricing=kind==='pricing';
 return{ name:'YükUsta',answer:pricing?'İlan ücreti ve hizmet kapsamını ilan sahibiyle netleştir. YükVinç’e fiyat/pazarlık veya başka bir konu iletmek için İletişim sayfasını kullan.':'Şikâyet, ilan düzeltme/kaldırma veya başka bir talep için İletişim sayfasından ilan başlığı ve numarasıyla mesaj gönder.',listings:[],alternatives:[],contact_url:'/iletisim/',conversation_id:'',mode:'contact'};
}
function needsSearch(intent){return Boolean(intent.city||intent.district||intent.category||intent.categoryAmbiguous||intent.locationAmbiguous||intent.unknownLocation||intent.terms.length)}
const askForCity=intent=>intent.category?`Hangi şehir veya ilçede ${categoryLabel(intent.category)} arıyorsun?`:intent.categories?.length?`Hangi şehirde arıyorsun? Kategori seçenekleri: ${intent.categories.map(categoryLabel).join(' veya ')}.`:'Hangi şehirde arıyorsun?';
export async function onRequestPost({request,env}){
 if(!isAllowedOrigin(request))return fail('İstek kaynağı doğrulanamadı.',403);
 if(!env.DB)return fail('İlan veritabanına şu an ulaşılamıyor.',503);
 let data;try{data=await readJson(request,8192)}catch{return fail('Mesaj biçimi geçersiz veya çok uzun.',400)}
 const question=typeof data.message==='string'?data.message.trim():'',conversation=aiConversationId(data.conversation_id),history=cleanAssistantHistory(data.history);
 if(question.length<4||question.length>AI_LIMITS.maxQuestionLength)return fail('Mesajın 4–600 karakter arasında olmalı.');
 const reply=payload=>{payload.conversation_id=conversation;if(!request.headers.get('accept')?.includes('text/event-stream'))return json(payload);const encoder=new TextEncoder(),stream=new ReadableStream({start(controller){for(const delta of String(payload.answer||'').match(/.{1,48}/gs)||[])controller.enqueue(encoder.encode('data: '+JSON.stringify({type:'delta',delta})+'\n\n'));controller.enqueue(encoder.encode('data: '+JSON.stringify({type:'result',data:payload})+'\n\n'));controller.close()}});return new Response(stream,{headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})};
 const started=Date.now();
 try{
  const config=await readAiModeration(env.DB);if(!config.enabled)return fail('YükUsta geçici olarak yönetici tarafından kapatıldı.',503);
  if(await limited(env,request,AI_RATE_LIMIT_ACTION,AI_LIMITS.perIpCalls,AI_LIMITS.perIpWindowSeconds))return fail('YükUsta’ya kısa sürede çok fazla mesaj gönderildi. Biraz sonra tekrar dene.',429);
  const daily=await env.DB.prepare("SELECT COUNT(*) AS n FROM ai_audit WHERE action='assistant.request' AND created_at>=unixepoch('now','start of day')").first();
  if(Number(daily?.n||0)>=AI_LIMITS.dailyCalls)return fail('Günlük sohbet sınırına ulaşıldı. Arama menüsündeki filtreleri kullanabilirsin.',429);
  await audit(env,'visitor','assistant.request','started',{conversation_id:conversation});
  const normalized=foldSearch(question);
  if(/\b(kaza|yaralanma|yaraland|yangin|kanama|ambulans)\w*/.test(normalized))return reply({name:'YükUsta',answer:'Önce 112’yi arayın. Güvenli bir yerde bekleyin; bu sohbet acil müdahale hizmeti değildir.',listings:[],alternatives:[],mode:'emergency'});
  const requestKind=classifyAssistantRequest(question);
  if(requestKind==='complaint'||requestKind==='pricing'||requestKind==='admin_action'||/\b(kaldir|duzeltme|duzelt|yanlis ilan|sahte ilan)\b/.test(normalized)){
   const payload=contactResponse(requestKind);await saveConversation(env,conversation,question,payload.answer,'contact_redirect');await audit(env,'visitor','assistant.response','completed',{conversation_id:conversation,mode:'contact',duration_ms:Date.now()-started});return reply(payload);
  }
  const help=siteHelp(question);
  if(help){
   const greeting=/^(merhaba|selam|iyi gunler|ne yapabilirsin|yardim)$/.test(normalized);
   const answer=greeting?await safeModelAnswer(env,'greeting',help):help;
   await saveConversation(env,conversation,question,answer,'answered');await audit(env,'visitor','assistant.response','completed',{conversation_id:conversation,mode:'help',duration_ms:Date.now()-started});return reply({name:'YükUsta',answer,listings:[],alternatives:[],mode:'help'});
  }
  const intent=searchIntent(question,history);
  if(intent.locationAmbiguous){const answer='Bu il veya ilçe adı birden fazla konumla eşleşiyor. Hangi ili kastediyorsun?';await saveConversation(env,conversation,question,answer,'clarify');return reply({name:'YükUsta',answer,listings:[],alternatives:[],mode:'clarify'})}
  if(intent.unknownLocation){const answer='Bu konumu anlayamadım. İl/ilçeyi yazabilir ya da arama menüsünden listeden seçebilirsin.';await saveConversation(env,conversation,question,answer,'clarify');return reply({name:'YükUsta',answer,listings:[],alternatives:[],mode:'clarify'})}
  if(intent.categoryAmbiguous){const answer='Birden fazla hizmet türü anladım. Vinç, çekici/yol yardımı, manlift veya başka birini seçer misin?';await saveConversation(env,conversation,question,answer,'clarify');return reply({name:'YükUsta',answer,listings:[],alternatives:[],mode:'clarify'})}
  if(!needsSearch(intent)){
   const answer='Hangi şehirde, ne arıyorsun? Vinç, çekici/yol yardımı, manlift veya başka bir ekipmanı yazabilirsin.';
   await saveConversation(env,conversation,question,answer,'clarify');return reply({name:'YükUsta',answer,listings:[],alternatives:[],mode:'clarify',create_url:'/ilan-ver/'})
  }
  if(!intent.city){const answer=askForCity(intent);await saveConversation(env,conversation,question,answer,'clarify');return reply({name:'YükUsta',answer,listings:[],alternatives:[],mode:'clarify'})}
  if(!intent.category){const answer=`${intent.city}${intent.district?' · '+intent.district:''} için hangi ekipmanı arıyorsun? Vinç, çekici/yol yardımı veya manlift yazabilirsin.`;await saveConversation(env,conversation,question,answer,'clarify');return reply({name:'YükUsta',answer,listings:[],alternatives:[],mode:'clarify'})}
  const fetched=await assistantPublicItems(env.DB,{category:intent.category,city:intent.city,district:intent.district,limit:100}),ranked=rankAssistantListings(fetched,intent),listings=publicCards(ranked);
  let alternatives=[];
  if(!listings.length){
   const elsewhere=await assistantPublicItems(env.DB,{category:intent.category,excludeCity:intent.city,limit:30}),rankedElsewhere=rankAssistantListings(elsewhere,{...intent,city:'',district:''});
   if(rankedElsewhere.length)alternatives=publicCards(rankedElsewhere);
   else{const sameCity=await assistantPublicItems(env.DB,{city:intent.city,excludeCategory:intent.category,limit:30});alternatives=publicCards(rankAssistantListings(sameCity,{...intent,category:'',city:intent.city,district:''}))}
  }
  let answer=listings.length?assistantFallback(listings,intent):`${intent.city}${intent.district?' · '+intent.district:''} için şu an ${categoryLabel(intent.category)} ilanı bulamadım.`;
  const alternativesLabel=alternatives.length?(alternatives[0].city===intent.city?'Aynı şehirdeki diğer kategoriler':'Diğer şehirlerdeki ilanlar'):'';if(alternatives.length)answer+=` ${alternativesLabel} ayrı gösteriliyor.`;
  if(intent.locationCorrected)answer=`Konum adını ${intent.city} olarak düzelterek aradım. `+answer;
  await saveConversation(env,conversation,question,answer,listings.length||alternatives.length?'answered':'unanswered');
  await audit(env,'visitor','assistant.response','completed',{conversation_id:conversation,listing_count:listings.length,alternative_count:alternatives.length,mode:'search',duration_ms:Date.now()-started});
  return reply({name:'YükUsta',answer,listings,alternatives,alternatives_label:alternativesLabel,mode:'search'});
 }catch(error){
  await saveConversation(env,conversation,question,'','error');await audit(env,'system','assistant.response','failed',{name:error?.name||'Error'});console.error('[yukusta]',JSON.stringify({event:'assistant_failed',name:error?.name||'Error'}));return fail('Şu an yanıt veremiyorum. İlan filtrelerini kullanabilir veya İletişim sayfasına yazabilirsin.',503)
 }
}


