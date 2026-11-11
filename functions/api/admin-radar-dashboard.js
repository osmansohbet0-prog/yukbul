import {requireAdmin, json, fail} from '../_lib/core.js';

// Yöneticiye özel, salt okunur özet. Telefon veya özel kullanıcı bilgisi döndürmez.
export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (auth.response) return auth.response;
  const db = context.env.DB;
  try {
    const [leads, requests, sources, runs, buyers] = await Promise.all([
      db.prepare("SELECT id,title,organization,city,district,service_type,published_at,source_url,classification,verification,status,confidence,created_at,updated_at FROM lead_radar_leads WHERE status IN ('review','approved') AND classification IN ('relevant','review','uncertain') ORDER BY CASE WHEN status='review' THEN 0 ELSE 1 END, CASE WHEN city='Kocaeli' THEN 0 WHEN city IN ('Sakarya','İstanbul','Konya') THEN 1 ELSE 2 END, CASE WHEN verification='official_source' THEN 0 WHEN verification='manual_reviewed' THEN 1 ELSE 2 END, created_at DESC LIMIT 100").all(),
      db.prepare("SELECT id,title,category,city,district,urgency,status,created_at FROM job_requests WHERE status IN ('open','pending') ORDER BY CASE WHEN status='open' THEN 0 ELSE 1 END,CASE WHEN city='Kocaeli' THEN 0 WHEN city IN ('Sakarya','İstanbul','Konya') THEN 1 ELSE 2 END,created_at DESC LIMIT 50").all(),
      db.prepare("SELECT id,name,source_category,source_type,enabled,scan_interval_seconds,last_scan_at,last_scan_status,last_scan_count,consecutive_errors,access_method,permission_status FROM lead_radar_sources ORDER BY enabled DESC, CASE WHEN name LIKE '%Gebze%' OR name LIKE '%Kocaeli%' OR name LIKE '%Dilovası%' THEN 0 WHEN name LIKE '%Adapazarı%' OR name LIKE '%Akyazı%' THEN 1 ELSE 2 END,name LIMIT 200").all(),
      db.prepare("SELECT r.started_at,r.outcome,r.items_seen,r.candidates_added,r.duplicates_linked,r.items_rejected,r.error_message,s.name source_name FROM lead_radar_scan_runs r LEFT JOIN lead_radar_sources s ON s.id=r.source_id ORDER BY r.started_at DESC LIMIT 30").all(),
      db.prepare("SELECT count(*) total,coalesce(sum(demand_status='open_verified'),0) verified_open FROM radar_buyer_contacts").first()
    ]);
    const rawLeads=leads.results||[], rawRequests=requests.results||[], rawSources=sources.results||[];
    return json({
      updated_at:Math.floor(Date.now()/1000),
      summary: {
        open_requests:rawRequests.filter(x=>x.status==='open').length,
        review:rawLeads.filter(x=>x.status==='review').length,
        approved:rawLeads.filter(x=>x.status==='approved').length,
        active_sources:rawSources.filter(x=>Number(x.enabled)===1).length,
        source_errors:rawSources.filter(x=>Number(x.enabled)===1&&Number(x.consecutive_errors)>0).length,
        verified_buyers:Number(buyers?.verified_open||0)
      },
      requests:rawRequests,
      leads:rawLeads,
      sources:rawSources,
      runs:runs.results||[]
    });
  } catch {
    return fail('İş Radarı özeti yüklenemedi.',503);
  }
}
