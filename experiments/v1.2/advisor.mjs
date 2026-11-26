const catalog=Object.freeze({
 requirements:'Resmî şartnameyi açıp makine türü, tonaj, çalışma yarıçapı ve yük diyagramını doğrulayın.',
 documents:'Gerekli belgeleri ve teslim biçimini resmî dokümandan kontrol edin.',
 deadline:'Son başvuru saatini ve varsa değişiklik duyurusunu resmî sayfadan kontrol edin.',
 eligibility:'Teminat, şirket statüsü ve özel yeterlilik koşullarını ilan dokümanından doğrulayın.',
 application:'Başvuruyu yalnızca doğrulanmış resmî başvuru sayfası üzerinden yapın.'
});

export async function guideTender(context,deps){
  const {request,env}=context;
  if(request.method!=='POST')return Response.json({error:'Yöntem desteklenmiyor.'},{status:405});
  const auth=await deps.requireMember(context);
  if(auth.response)return auth.response;
  const data=await deps.readJson(request,2048);
  if(!/^[A-Za-z0-9_-]{8,85}$/.test(data.id))return Response.json({error:'İhale bulunamadı.'},{status:404});
  const item=await env.DB.prepare(`SELECT l.id,l.service_type,l.public_expires_at,a.portal_type,a.verification_status
    FROM lead_radar_leads l LEFT JOIN lead_radar_application_links a ON a.lead_id=l.id
    WHERE l.id=? AND l.status='approved' AND l.verification IN ('official_source','manual_reviewed') AND l.public_at<=unixepoch() AND l.public_expires_at>unixepoch()`)
    .bind(data.id).first();
  if(!item)return Response.json({error:'İhale bulunamadı.'},{status:404});
  let order=Object.keys(catalog);
  let mode='rules';
  // AI can reorder established advice. Its output cannot supply eligibility facts.
  if(env.V12_AI_ENABLED==='true'&&env.AI&&env.V12_AI_MODEL){
    try{
      const claimed=await env.DB.prepare(`INSERT INTO v12_advisor_usage(user_id,day,requested) VALUES(?,date('now'),1)
        ON CONFLICT(user_id,day) DO UPDATE SET requested=requested+1 WHERE requested<3`).bind(auth.member.id).run();
      if(claimed.meta.changes){
        const input={portal:['public_tender','direct_procurement'].includes(item.portal_type)?item.portal_type:'unknown',
          officialEntry:item.verification_status==='verified_direct',
          endsIn48Hours:item.public_expires_at-Date.now()/1000<172800};
        const answer=await env.AI.run(env.V12_AI_MODEL,{max_tokens:85,temperature:0,messages:[
          {role:'system',content:'Return only a JSON array ordering these fixed keys: requirements, documents, deadline, eligibility, application. Never return prose or claims.'},
          {role:'user',content:JSON.stringify(input)}
        ]});
        const parsed=JSON.parse(answer.response);
        if(Array.isArray(parsed)&&new Set(parsed).size===order.length&&parsed.length===order.length&&parsed.every(k=>Object.hasOwn(catalog,k))){
          order=parsed;
          mode='ai_ordered';
        }
      }
    }catch{/* The deterministic guide remains available. */}
  }
  return Response.json({mode,tips:order.map(k=>catalog[k]),url:'/ihale-basvuru/'+encodeURIComponent(item.id)+'/'},
    {headers:{'cache-control':'private, no-store'}});
}
