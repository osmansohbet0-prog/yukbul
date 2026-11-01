const ADMIN_PANEL_PATHS = new Map([
  ['/admin/', ['text/html; charset=utf-8', 'html']],
  ['/assets/admin-layout.css', ['text/css; charset=utf-8', 'layoutCss']],
  ['/assets/admin.js', ['text/javascript; charset=utf-8', 'adminJs']],
  ['/assets/moderation-admin.js', ['text/javascript; charset=utf-8', 'moderationJs']],
  ['/assets/directory-admin.js', ['text/javascript; charset=utf-8', 'directoryJs']],
  ['/assets/lead-radar-admin.js', ['text/javascript; charset=utf-8', 'leadRadarJs']],
  ['/assets/job-admin.js', ['text/javascript; charset=utf-8', 'jobAdminJs']],
]);

export function adminPanelAssetResponse(path, method, assets) {
  if (method !== 'GET' && method !== 'HEAD') return null;
  const match = ADMIN_PANEL_PATHS.get(path);
  if (!match || typeof assets?.[match[1]] !== 'string') return null;
  return new Response(method === 'HEAD' ? null : assets[match[1]], {
    headers: {
      'content-type': match[0],
      'cache-control': 'private, no-store',
      'x-admin-assets': 'synchronized',
    },
  });
}

export const adminPanelAssetPaths = [...ADMIN_PANEL_PATHS.keys()];
