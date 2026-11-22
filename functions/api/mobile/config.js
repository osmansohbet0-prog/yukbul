export async function onRequestGet({env}) {
  const clientId = typeof env.GOOGLE_CLIENT_ID === 'string' ? env.GOOGLE_CLIENT_ID : '';
  return Response.json({ google_client_id: clientId }, {
    headers: { 'cache-control': 'public, max-age=3600, stale-while-revalidate=3600' },
  });
}
