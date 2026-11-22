export async function onRequestGet({env}) {
  if (!env.DB) return Response.json({ error: 'İhale fırsatları şu anda kullanılamıyor.' }, { status: 503 });
  try {
    const result = await env.DB.prepare(
      "SELECT id,organization,title,city,district,service_type,published_at,public_summary,public_at,public_expires_at FROM lead_radar_leads WHERE status='approved' AND classification='relevant' AND verification='manual_reviewed' AND public_at IS NOT NULL AND (public_expires_at IS NULL OR public_expires_at>unixepoch()) ORDER BY COALESCE(public_at,created_at) DESC LIMIT 100"
    ).all();
    return Response.json({ items: result.results || [] }, {
      headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=120' },
    });
  } catch {
    return Response.json({ error: 'İhale fırsatları yüklenemedi.' }, { status: 503 });
  }
}
