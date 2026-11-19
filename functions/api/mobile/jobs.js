export async function onRequestGet({env}) {
  if (!env.DB) return Response.json({ error: 'İş talepleri şu anda kullanılamıyor.' }, { status: 503 });
  try {
    const result = await env.DB.prepare(
      "SELECT id,title,description,category,city,district,urgency,start_text,duration,payment,status,created_at FROM job_requests WHERE status='open' ORDER BY created_at DESC LIMIT 100"
    ).all();
    return Response.json({ items: result.results || [] }, {
      headers: { 'cache-control': 'public, max-age=30, stale-while-revalidate=60' },
    });
  } catch {
    return Response.json({ error: 'İş talepleri yüklenemedi.' }, { status: 503 });
  }
}
