import {listingProfile,tenderRequirements,matchTender} from './matching.mjs';

const MAX_TENDERS=80;
const MAX_MACHINES=25;
const ID=/^[a-zA-Z0-9_-]{8,85}$/;
const safeJson=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const errmsg=(error,status)=>safeJson({error},status);
const cancelled=/iptal\s+(?:edildi|edilmiştir|edilmistir)|ihale\s+iptal(?:i|\s+edildi)/iu;
const liveSQL=`l.status='approved' AND l.verification IN ('official_source','manual_reviewed')
 AND l.public_at IS NOT NULL AND l.public_at<=unixepoch() AND l.public_expires_at>unixepoch()`;
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),x=>x.toString(16).padStart(2,'0')).join('');

export function officialUrl(value){
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password&&/(^|\.)(kik\.gov\.tr|gov\.tr|bel\.tr|edu\.tr)$/.test(url.hostname)?url.href:null;
  }catch{return null}
}

function notice(row, scrub){
  const application=row.verification_status==='verified_direct'?officialUrl(row.official_application_url):null;
  const {requirements,...summary}={...row,requirements:tenderRequirements(row)};
  return {
    id:summary.id,title:scrub(summary.title),city:summary.city,district:summary.district,category:requirements.category,
    deadline:requirements.deadline,published:summary.public_at,officialUrl:application||officialUrl(row.official_notice_url)||officialUrl(row.source_url),
    applicationVerified:!!application,helpUrl:'/ihale-basvuru/'+encodeURIComponent(summary.id)+'/',
    requirements:{...requirements,documents:scrub(requirements.documents),qualifications:scrub(requirements.qualifications),
      duration:scrub(requirements.duration),hours:scrub(requirements.hours),scheduled:scrub(requirements.scheduled)}
  };
}

export async function boardData(env,member,scrub=value=>value){
  const db=env.DB;
  const result=await db.prepare(`SELECT l.id,l.title,l.city,l.district,l.service_type,l.public_at,l.public_expires_at,
    l.source_url,l.public_summary,a.official_application_url,a.official_notice_url,a.verification_status,a.ikn,l.updated_at
    FROM lead_radar_leads l LEFT JOIN lead_radar_application_links a ON a.lead_id=l.id
    WHERE ${liveSQL} ORDER BY l.public_at DESC,l.id LIMIT ?`).bind(MAX_TENDERS+1).all();
  const seen=new Set();
  const candidates=result.results.slice(0,MAX_TENDERS).filter(row=>{
    if(cancelled.test([row.title,row.public_summary].join(' ')))return false;
    const key=/^20\d{2}\/\d+$/.test(row.ikn||'')?'ikn:'+row.ikn:'id:'+row.id;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
  const opportunities=candidates.map(row=>notice(row,scrub));
  const publicBoard={member:false,machines:[],opportunities,limited:result.results.length>MAX_TENDERS};
  if(!member)return publicBoard;
  const [listings,saved]=await Promise.all([
    db.prepare(`SELECT id,title,description,COALESCE(NULLIF(service_category,''),NULLIF(category_detail,''),category) AS category,
      city,district,price_unit,paid_until,trial_expires_at,updated_at FROM listings
      WHERE user_id=? AND status='approved' AND member_paused_at IS NULL
        AND MAX(COALESCE(trial_expires_at,0),COALESCE(paid_until,0))>unixepoch()
        AND NOT EXISTS(SELECT 1 FROM listing_directory d WHERE d.listing_id=listings.id AND d.removed_at IS NOT NULL)
      ORDER BY updated_at DESC,id LIMIT ?`).bind(member.id,MAX_MACHINES+1).all(),
    db.prepare('SELECT lead_id FROM v12_saved_tenders WHERE user_id=? ORDER BY created_at DESC LIMIT 250').bind(member.id).all()
  ]);
  const machineRows=listings.results.slice(0,MAX_MACHINES);
  const fingerprint=await digest(['1.2.0',candidates,machineRows]);
  const cached=await db.prepare('SELECT fingerprint,result_json FROM v12_member_match_cache WHERE user_id=?').bind(member.id).first();
  let matches;
  if(cached?.fingerprint===fingerprint)matches=JSON.parse(cached.result_json);
  else{
    const machines=machineRows.map(row=>listingProfile({...row,active:true}));
    const now=Math.floor(Date.now()/1000);
    matches=Object.fromEntries(opportunities.map(item=>[
      item.id,machines.map(machine=>({machine:machine.id,...matchTender(machine,item.requirements,{now})})).filter(match=>match.recommended)
    ]));
    const serialized=JSON.stringify(matches);
    if(new TextEncoder().encode(serialized).byteLength<=262144)await db.prepare(`INSERT INTO v12_member_match_cache(user_id,fingerprint,result_json) VALUES(?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET fingerprint=excluded.fingerprint,result_json=excluded.result_json,computed_at=unixepoch()`)
      .bind(member.id,fingerprint,serialized).run();
  }
  const savedIds=new Set(saved.results.map(row=>row.lead_id));
  return {...publicBoard,member:true,
    machines:machineRows.map(row=>({id:row.id,title:scrub(row.title),city:row.city})),
    limited:publicBoard.limited||listings.results.length>MAX_MACHINES,
    opportunities:opportunities.map(item=>({...item,saved:savedIds.has(item.id),matches:matches[item.id]??[]}))
  };
}

export async function tenderApi(context,deps){
  const {request,env}=context;
  if(!env.DB)return errmsg('İhale verilerine ulaşılamıyor.',503);
  if(request.method==='GET')return safeJson(await boardData(env,await deps.currentMember(request,env),deps.scrub));
  if(request.method!=='POST')return errmsg('Yöntem desteklenmiyor.',405);
  const auth=await deps.requireMember(context);
  if(auth.response)return auth.response;
  const data=await deps.readJson(request,2048);
  if(!ID.test(data.id)||typeof data.saved!=='boolean')return errmsg('İhale seçimi geçersiz.',400);
  const db=env.DB;
  if(data.saved){
    const result=await db.prepare(`INSERT INTO v12_saved_tenders(user_id,lead_id)
      SELECT ?,l.id FROM lead_radar_leads l WHERE l.id=? AND ${liveSQL}
      AND (SELECT COUNT(*) FROM v12_saved_tenders WHERE user_id=?)<250 ON CONFLICT DO NOTHING`)
      .bind(auth.member.id,data.id,auth.member.id).run();
    if(!result.meta.changes){
      const saved=await db.prepare('SELECT 1 AS saved FROM v12_saved_tenders WHERE user_id=? AND lead_id=?').bind(auth.member.id,data.id).first();
      if(!saved)return errmsg('İhale kapandı veya kayıt sınırına ulaşıldı.',409);
    }
  }else await db.prepare('DELETE FROM v12_saved_tenders WHERE user_id=? AND lead_id=?').bind(auth.member.id,data.id).run();
  return safeJson({saved:data.saved});
}
