import {maskEmail,maskPhone} from '../_lib/moderation.js';
import {fail,json,requireAdmin,readJson,audit,randomId} from '../_lib/core.js';
import {runImprovementReview} from '../_lib/ai-improvements.js';
const repo='osmansohbet0-prog/yukbul';
async function gh(env,path,method='GET',body){
 if(!env.GITHUB_TOKEN)throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');
 const response=await fetch('https://api.github.com'+path,{method,headers:{authorization:'Bearer '+env.GITHUB_TOKEN,accept:'application/vnd.github+json','content-type':'application/json','x-github-api-version':'2022-11-28','user-agent':'YukVinc-AI-Proposals'},body:body?JSON.stringify(body):undefined});
 const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error('GITHUB_'+response.status);return payload;
}
async function proposalPullRequest(env,item){
 const ref=await gh(env,'/repos/'+repo+'/git/ref/heads/main'),parent=ref.object.sha,commit=await gh(env,'/repos/'+repo+'/git/commits/'+parent),branch='ai/proposal-'+item.id.toLowerCase();
 const content='# YükUsta geliştirme önerisi\n\nBu PR yalnızca incelenmek üzere hazırlanmış öneri belgesidir. Çalışan kodu değiştirmez ve otomatik birleştirme yapmaz.\n\n## Öneri\n'+item.title+'\n\n## Bulgu\n'+item.finding+'\n\n## Gerekçe\n'+item.rationale+'\n\n## Önerilen yaklaşım\n'+item.proposal+'\n\n## İnceleme\nKod değişikliği, güvenlik ve fiyat kararları insan tarafından ayrıca değerlendirilmelidir.\n';
 const blob=await gh(env,'/repos/'+repo+'/git/blobs','POST',{content,encoding:'utf-8'}),tree=await gh(env,'/repos/'+repo+'/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'docs/ai-improvement-proposals/'+item.id+'.md',mode:'100644',type:'blob',sha:blob.sha}]}),newCommit=await gh(env,'/repos/'+repo+'/git/commits','POST',{message:'docs: add reviewed AI improvement proposal',tree:tree.sha,parents:[parent]});
 await gh(env,'/repos/'+repo+'/git/refs','POST',{ref:'refs/heads/'+branch,sha:newCommit.sha});
 return gh(env,'/repos/'+repo+'/pulls','POST',{title:'AI önerisi: '+item.title,head:branch,base:'main',draft:true,body:'Admin tarafından onaylanan YükUsta önerisi. Bu taslak PR yalnızca inceleme belgesi içerir; uygulama kodu üretmez veya birleştirmez.\n\nÖneri: '+item.title});
}
export async function onRequestGet({request,env}){
 const admin=await requireAdmin({request,env});if(admin.response)return admin.response;
 try{const [{results:suggestions=[]},{results:tickets=[]}]=await Promise.all([env.DB.prepare('SELECT * FROM ai_improvement_suggestions ORDER BY created_at DESC LIMIT 50').all(),env.DB.prepare('SELECT id,source,summary_redacted,contact_name,contact_details,consent_email,email_status,status,created_at FROM support_tickets ORDER BY created_at DESC LIMIT 100').all()]);return json({suggestions,tickets:tickets.map(row=>({...row,contact_name:row.contact_name?'[ad gizlendi]':null,contact_details:row.contact_details?row.contact_details.includes('@')?maskEmail(row.contact_details):maskPhone(row.contact_details):null}))})}catch{return fail('Yapay zekâ önerileri ve destek kayıtları alınamadı.',503)}
}
export async function onRequestPost({request,env}){
 const admin=await requireAdmin({request,env});if(admin.response)return admin.response;
 try{const d=await readJson(request,4096);
  if(d.run_review===true){const result=await runImprovementReview(env);await audit(env,admin.admin.id,'ai.improvement.review','system',null,result);return json({ok:true,result})}
  if(d.ticket_id){const status=String(d.status||'');if(!['reviewed','closed'].includes(status))return fail('Destek durumu geçersiz.');const r=await env.DB.prepare("UPDATE support_tickets SET status=?,updated_at=unixepoch() WHERE id=? AND status='open'").bind(status,String(d.ticket_id)).run();if(!r.meta?.changes)return fail('Açık destek kaydı bulunamadı.',404);await audit(env,admin.admin.id,'ai.support.update','ticket',String(d.ticket_id),{status});return json({ok:true})}
  const id=String(d.id||''),status=String(d.status||'');if(!/^[A-Za-z0-9_-]{8,80}$/.test(id)||!['approved','rejected'].includes(status))return fail('Öneri kararı geçersiz.');
  const item=await env.DB.prepare("SELECT * FROM ai_improvement_suggestions WHERE id=? AND status='pending'").bind(id).first();if(!item)return fail('Bekleyen öneri bulunamadı.',404);
  if(status==='rejected'){await env.DB.prepare("UPDATE ai_improvement_suggestions SET status='rejected',reviewed_at=unixepoch() WHERE id=?").bind(id).run();await audit(env,admin.admin.id,'ai.improvement.reject','suggestion',id,{});return json({ok:true})}
  const pr=await proposalPullRequest(env,item);await env.DB.prepare("UPDATE ai_improvement_suggestions SET status='approved',pull_request_url=?,reviewed_at=unixepoch() WHERE id=?").bind(pr.html_url,id).run();await audit(env,admin.admin.id,'ai.improvement.approve','draft_pr',id,{pull_request_url:pr.html_url});return json({ok:true,pull_request_url:pr.html_url})
 }catch(error){console.error('[ai-suggestions]',JSON.stringify({event:'admin_action_failed',name:error?.message||'Error'}));return fail(error?.message==='GITHUB_TOKEN_NOT_CONFIGURED'?'GitHub PR yetkisi yapılandırılmadı; öneri değişmeden bekliyor.':'İşlem tamamlanamadı. Öneri durumu korunuyor.',503)}
}
