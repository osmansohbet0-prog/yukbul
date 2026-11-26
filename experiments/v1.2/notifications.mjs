import {boardData} from './tenders.mjs';

export async function notificationApi(context,deps){
  const {request,env}=context;
  const auth=await deps.requireMember(context);
  if(auth.response)return auth.response;
  const userId=auth.member.id,db=env.DB;
  const response=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store'}});
  if(request.method==='POST'){
    const data=await deps.readJson(request,2048);
    if(data.action==='read'&&/^[A-Za-z0-9_-]{8,85}$/.test(data.id)){
      await db.prepare('UPDATE v12_tender_alerts SET read_at=COALESCE(read_at,unixepoch()) WHERE user_id=? AND lead_id=?').bind(userId,data.id).run();
      return response({ok:true});
    }
    if(typeof data.site!=='boolean'||typeof data.email!=='boolean')return response({error:'Bildirim tercihi geçersiz.'},400);
    await db.batch([
      db.prepare(`INSERT INTO v12_tender_preferences VALUES(?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET site_enabled=excluded.site_enabled,email_enabled=excluded.email_enabled`)
        .bind(userId,Number(data.site),Number(data.email)),
      db.prepare("UPDATE v12_tender_alerts SET state='cancelled' WHERE user_id=? AND state='queued' AND ?=0").bind(userId,Number(data.email))
    ]);
    return response({ok:true});
  }
  if(request.method!=='GET')return response({error:'Yöntem desteklenmiyor.'},405);
  const preference=await db.prepare('SELECT site_enabled,email_enabled FROM v12_tender_preferences WHERE user_id=?').bind(userId).first();
  const results=preference?.site_enabled
    ? (await db.prepare(`SELECT l.id,l.title,a.read_at FROM v12_tender_alerts a JOIN lead_radar_leads l ON a.lead_id=l.id
        WHERE a.user_id=? AND a.site_visible=1 AND l.status='approved' AND l.public_at<=unixepoch() AND l.public_expires_at>unixepoch()
        ORDER BY a.created_at DESC LIMIT 50`).bind(userId).all()).results:[];
  return response({site:!!preference?.site_enabled,email:!!preference?.email_enabled,
    items:results.map(row=>({...row,title:deps.scrub(row.title)}))});
}

export async function scanTenderAlerts(env){
  const db=env.DB;
  if(!db)return false;
  const lease=await db.prepare(`INSERT INTO v12_tender_scan VALUES(1,'',unixepoch()+60)
    ON CONFLICT(singleton) DO UPDATE SET next_at=excluded.next_at WHERE next_at<=unixepoch() RETURNING cursor`).first();
  if(!lease)return false;
  const {results}=await db.prepare(`SELECT p.user_id,p.site_enabled,p.email_enabled FROM v12_tender_preferences p
    JOIN users u ON u.id=p.user_id WHERE u.active=1 AND u.role='member' AND p.user_id>?
    AND (p.site_enabled=1 OR p.email_enabled=1) ORDER BY p.user_id LIMIT 6`).bind(lease.cursor).all();
  for(const member of results){
    const data=await boardData(env,{id:member.user_id});
    const insert=data.opportunities.filter(t=>t.published>=Date.now()/1000-7*86400&&t.matches.some(m=>m.score>=75)&&t.officialUrl)
      .map(t=>t.id);
    if(insert.length)await db.prepare(`INSERT INTO v12_tender_alerts(user_id,lead_id,site_visible,state)
      SELECT p.user_id,j.value,p.site_enabled,CASE WHEN p.email_enabled=1 THEN 'queued' ELSE 'none' END
      FROM json_each(?) j CROSS JOIN v12_tender_preferences p
      WHERE p.user_id=? AND (p.site_enabled=1 OR p.email_enabled=1)
      ON CONFLICT(user_id,lead_id) DO NOTHING`).bind(JSON.stringify(insert),member.user_id).run();
  }
  await db.prepare('UPDATE v12_tender_scan SET cursor=? WHERE singleton=1').bind(results.length<6?'':results.at(-1).user_id).run();
  return true;
}

export async function sendTenderAlerts(env){
  if(!env.DB||!env.EMAIL||!env.LISTING_NOTIFICATION_FROM)return;
  const db=env.DB;
  await db.prepare("UPDATE v12_tender_alerts SET state='uncertain' WHERE state='sending' AND next_at<=unixepoch()").run();
  await db.prepare(`UPDATE v12_tender_alerts AS a SET state='cancelled' WHERE state='queued' AND
    (NOT EXISTS(SELECT 1 FROM lead_radar_leads l WHERE l.id=a.lead_id AND l.status='approved' AND l.public_expires_at>unixepoch())
    OR NOT EXISTS(SELECT 1 FROM v12_tender_preferences p JOIN users u ON u.id=p.user_id
       WHERE p.user_id=a.user_id AND p.email_enabled=1 AND u.active=1))`).run();
  const {results}=await db.prepare(`SELECT a.user_id,a.lead_id,a.attempts,u.email,l.title FROM v12_tender_alerts a
    JOIN v12_tender_preferences p ON p.user_id=a.user_id JOIN users u ON u.id=a.user_id JOIN lead_radar_leads l ON l.id=a.lead_id
    WHERE a.state='queued' AND a.next_at<=unixepoch() AND p.email_enabled=1 AND u.active=1 AND l.status='approved'
    AND l.public_expires_at>unixepoch() ORDER BY a.next_at LIMIT 6`).all();
  for(const item of results){
    const lock=await db.prepare(`UPDATE v12_tender_alerts SET state='sending',attempts=attempts+1,next_at=unixepoch()+900
      WHERE user_id=? AND lead_id=? AND state='queued' AND next_at<=unixepoch()
      AND EXISTS(SELECT 1 FROM v12_tender_preferences p WHERE p.user_id=? AND p.email_enabled=1)`)
      .bind(item.user_id,item.lead_id,item.user_id).run();
    if(!lock.meta.changes)continue;
    let status='sent';
    try{
      await env.EMAIL.send({to:item.email,from:{email:env.LISTING_NOTIFICATION_FROM,name:'YükVinç'},
        subject:'YükVinç · Yeni ihale eşleşmesi',
        text:'İlanınıza göre yeni bir ihale eşleşmesi bulundu. Başvuru şartlarını ve bildirim tercihlerinizi YükVinç üzerinden inceleyebilirsiniz. https://yukvinc.com.tr/ihale-duyurulari/'});
    }catch(e){
      status=e?.code==='rate_limited'?(item.attempts<3?'queued':'abandoned'):'uncertain';
    }
    await db.prepare(`UPDATE v12_tender_alerts SET state=?,next_at=unixepoch()+?,
      sent_at=CASE WHEN ?='sent' THEN unixepoch() ELSE NULL END WHERE user_id=? AND lead_id=? AND state='sending'`)
      .bind(status,60*2**(item.attempts+1),status,item.user_id,item.lead_id).run();
  }
}
