import {runBudgetedAI} from '../../_lib/ai-budget.js';
import {fail,json,requireMember,limited} from '../../_lib/member.js';
import {readJson} from '../../_lib/core.js';
import {redactForAI} from '../../_lib/listings.js';

export async function onRequestPost(context){
  const auth=await requireMember(context);
  if(auth.response)return auth.response;
  const {env,request}=context;
  if(env.AI_ENABLED!=='true'||!env.AI)return fail('Yapay zekâ metin yardımı kapalı. İlanı elle yayınlayabilirsin.',503);
  let reserved=false;
  const usageDate=new Date().toISOString().slice(0,10);
  try{
    if(await limited(env,request,'ai',10,3600))return fail('Yapay zekâ için çok fazla istek yapıldı. Bir süre sonra dene.',429);
    const data=await readJson(request,8192);
    const note=String(data.note||'').trim();
    if(note.length<20||note.length>1200)return fail('Kısa not 20–1200 karakter olmalı.');
    await env.DB.prepare('INSERT OR IGNORE INTO ai_usage(user_id,usage_date,count) VALUES(?,?,0)').bind(auth.member.id,usageDate).run();
    const quota=await env.DB.prepare('UPDATE ai_usage SET count=count+1 WHERE user_id=? AND usage_date=? AND count<2').bind(auth.member.id,usageDate).run();
    if(!quota.meta?.changes)return fail('Bugünkü ücretsiz öneri hakkı tamamlandı.',429);
    reserved=true;
    const result=await runBudgetedAI(env,'@cf/meta/llama-3.3-70b-instruct-fp8-fast',{messages:[
      {role:'system',content:'Türkçe ilan editörüsün. Kullanıcının kısa notunu yalnızca verilen bilgilere bağlı kalarak düzenle. Uydurma özellik, fiyat, hizmet bölgesi veya iletişim bilgisi ekleme. JSON döndür: title, description, category. category yalnızca crane,tow,basket,machine,lift,operator olabilir. En fazla 120 karakter başlık, 1200 karakter açıklama.'},
      {role:'user',content:redactForAI(note)}
    ],max_tokens:420,temperature:0.2});
    let output=typeof result.response==='string'?result.response:JSON.stringify(result.response||result);
    output=output.replace(/^\`\`\`(?:json)?\s*|\s*\`\`\`$/g,'');
    const parsed=JSON.parse(output);
    if(typeof parsed.title!=='string'||typeof parsed.description!=='string'||!['crane','tow','basket','machine','lift','operator'].includes(parsed.category))throw new Error('Invalid AI response');
    return json({suggestion:{title:parsed.title.slice(0,120),description:parsed.description.slice(0,1200),category:parsed.category}});
  }catch(error){
    if(reserved){
      try{await env.DB.prepare('UPDATE ai_usage SET count=MAX(count-1,0) WHERE user_id=? AND usage_date=?').bind(auth.member.id,usageDate).run()}catch(refundError){console.error('[ai-suggest]',JSON.stringify({event:'quota_refund_failed',name:refundError?.name||'Error'}))}
    }
    console.error('[ai-suggest]',JSON.stringify({event:'suggestion_failed',name:error?.name||'Error'}));
    return fail('Metin önerisi şu an üretilemedi. Alanları elle doldurabilirsin.',503);
  }
}
