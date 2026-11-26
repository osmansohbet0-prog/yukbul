const checks=[
  {name:'database',severity:'critical',remedy:'D1 bağını ve Worker hata kayıtlarını kontrol et.',sql:'SELECT 1 AS reachable',interpret:r=>r.reachable===1?'D1 sorgusu çalıştı.':null},
  {name:'radar_sources',severity:'high',remedy:'Sorunlu kaynakların izinlerini ve son tarama kayıtlarını kontrol et.',
    sql:`SELECT COUNT(*) AS enabled,SUM(consecutive_errors>0) AS errors,MAX(last_success_at) AS latest
      FROM lead_radar_sources WHERE enabled=1`,interpret:r=>r.errors?null:r.enabled+' etkin kaynak; son başarı '+(r.latest||'ölçülmedi')+'.'},
  {name:'tenders',severity:'medium',remedy:'Yayınlanmış ihale kapsamını kontrol et.',
    sql:`SELECT COUNT(*) AS n FROM lead_radar_leads WHERE public_at>=unixepoch('now','start of day') AND status='approved'`,
    interpret:r=>r.n+' ihale bugün yayımlandı (UTC).'},
  {name:'matches',severity:'medium',remedy:'Eşleştirme önbelleği ve işlem kayıtlarını kontrol et.',
    sql:`SELECT COUNT(*) AS members,COALESCE(SUM((SELECT COUNT(*) FROM json_each(c.result_json) WHERE json_array_length(value)>0)),0) AS opportunities
      FROM v12_member_match_cache c WHERE computed_at>=unixepoch()-86400`,interpret:r=>r.members+' üye hesabında '+r.opportunities+' ihale eşleşmesi son 24 saatte hesaplandı.'},
  {name:'tender_mail',severity:'medium',remedy:'Mevcut ihale e-posta kuyruğunu incele.',
    sql:`SELECT SUM(status='sent' AND sent_at>=unixepoch()-86400) AS sent,
      SUM(status='uncertain' AND attempted_at>=unixepoch()-86400) AS uncertain,
      SUM(status='queued') AS queued FROM tender_email_outbox`,interpret:r=>r.uncertain?null:(r.sent||0)+' gönderildi, '+(r.queued||0)+' kuyrukta.'},
  {name:'renewals',severity:'high',remedy:'Yenileme tabloları ve yönetici uç noktasını kontrol et.',
    sql:`SELECT COUNT(*) AS pending FROM v222_renewals WHERE status='pending'`,interpret:r=>r.pending+' havale inceleme bekliyor.'}
];

export async function runGuardian(env){
  const db=env.DB;
  if(!db)return false;
  const lease=await db.prepare(`INSERT INTO v12_guardian_lease(singleton,next_at) VALUES(1,unixepoch()+900)
    ON CONFLICT(singleton) DO UPDATE SET next_at=excluded.next_at WHERE next_at<=unixepoch()`).run();
  if(!lease.meta.changes)return false;
  for(const check of checks){
    const began=Date.now();
    let state='ok',detail;
    try{
      const data=await db.prepare(check.sql).first();
      detail=check.interpret(data);
      if(!detail){state='degraded';detail=check.name==='radar_sources'?(data.errors||0)+' kaynakta tarama hatası var.':(data.uncertain||0)+' e-posta teslimatı belirsiz.'}
    }catch{
      state='failed';
      detail='Sağlık sorgusu yanıt vermedi.';
    }
    await db.batch([
      db.prepare(`INSERT INTO v12_guardian_checks(service,state,severity,detail,response_ms,checked_at,first_failure_at)
        VALUES(?,?,?,?,?,unixepoch(),CASE WHEN ?='ok' THEN NULL ELSE unixepoch() END)
        ON CONFLICT(service) DO UPDATE SET state=excluded.state,severity=excluded.severity,
          detail=excluded.detail,response_ms=excluded.response_ms,checked_at=excluded.checked_at,
          first_failure_at=CASE WHEN excluded.state='ok' THEN NULL ELSE COALESCE(first_failure_at,excluded.checked_at) END`)
        .bind(check.name,state,check.severity,detail,Date.now()-began,state),
      state==='ok'
        ? db.prepare('UPDATE v12_guardian_incidents SET resolved_at=unixepoch() WHERE service=? AND resolved_at IS NULL').bind(check.name)
        : db.prepare(`INSERT INTO v12_guardian_incidents(service,severity,detail,remedy) VALUES(?,?,?,?)
            ON CONFLICT(service) WHERE resolved_at IS NULL DO UPDATE SET detail=excluded.detail`).bind(check.name,check.severity,detail,check.remedy)
    ]);
  }
  return true;
}

export async function guardianApi(context,requireAdmin){
  const auth=await requireAdmin(context);
  if(auth.response)return auth.response;
  if(context.request.method!=='GET')return Response.json({error:'Yöntem desteklenmiyor.'},{status:405});
  const db=context.env.DB;
  const [checks,incidents,sources]=await Promise.all([
    db.prepare('SELECT * FROM v12_guardian_checks ORDER BY service').all(),
    db.prepare('SELECT service,severity,detail,remedy,opened_at,resolved_at FROM v12_guardian_incidents ORDER BY opened_at DESC LIMIT 40').all(),
    db.prepare(`SELECT name,last_success_at,last_scan_status,last_scan_count,consecutive_errors
      FROM lead_radar_sources WHERE enabled=1 ORDER BY consecutive_errors DESC,name LIMIT 100`).all()
  ]);
  return Response.json({version:'1.2.0-preview',rollback:'Cloudflare Worker 246',checks:checks.results,incidents:incidents.results,sources:sources.results},
    {headers:{'cache-control':'private, no-store'}});
}
