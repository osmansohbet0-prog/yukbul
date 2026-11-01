import {withSeoReview} from '../functions/_lib/seo-review.js';
import {withTenderBoard} from '../functions/_lib/tender-board.js';
import * as seoMonitor from '../functions/api/admin-seo-monitor.js';
import {runSeoMonitor} from '../functions/_lib/seo-monitor.js';
import seoReviewIcon from './seo-review-icon.js';
import {withJobBoard} from '../functions/_lib/job-board.js';
import jobBoardAssets from './job-board-assets.js';
import {withSiteApp} from '../functions/_lib/site-app.js';
import siteAppAssets from './site-app-assets.js';
import {siteStyles,analyticsStyles} from '../functions/_lib/public-styles.js';
import * as directoryAdmin from '../functions/api/admin-directory.js';
import * as leadRadar from '../functions/api/admin-lead-radar.js';
import { scheduledLeadRadar } from '../functions/_lib/lead-radar.js';
import * as listingMetrics from '../functions/api/admin-listing-metrics.js';
import * as listingEvent from '../functions/api/listing-event.js';
import {syncInbox} from '../functions/_lib/outreach.js';
import * as nearbySearch from '../functions/api/ai/nearby.js';
import * as moderationAdmin from '../functions/api/admin-moderation.js';
import * as priceCheck from '../functions/api/listings/price-check.js';
import { renderHome } from "../functions/_lib/home-render.js";
import { iconTags } from "../functions/_lib/discovery.js";
import { faviconIco, faviconPng, appleTouchIcon, siteManifest, robotsTxt } from "../functions/_lib/favicon-assets.js";
import memberNotificationAssets from './member-notification-assets.js';
import adminPanelAssets from './admin-panel-assets.js';
import { adminPanelAssetResponse } from '../functions/_lib/admin-panel-assets.js';
// Former Pages handlers are bundled and dispatched through this single Workers entry.
import * as health from "../functions/api/saglik.js";
import * as r0 from "../functions/api/admin-activity.js";
import * as r2 from "../functions/api/admin-listings.js";
import * as r3 from "../functions/api/admin-login.js";
import * as r39 from "../functions/api/admin-login-code.js";
import * as r4 from "../functions/api/admin-logout.js";
import * as r5 from "../functions/api/admin-media.js";
import * as r6 from "../functions/api/admin-reports.js";
import * as r7 from "../functions/api/admin-session.js";
import * as r8 from "../functions/api/admin-settings.js";
import * as r9 from "../functions/api/admin-users.js";
import * as r28 from "../functions/api/admin-ai.js";
import * as r29 from "../functions/api/ai/assistant.js";
import * as r30 from "../functions/api/ai/support.js";
import * as r31 from "../functions/api/admin-ai-suggestions.js";
import { runImprovementReview } from "../functions/_lib/ai-improvements.js";
import { processListingAgent } from "../functions/_lib/listing-agent.js";
import { processPublicationEmails } from "../functions/_lib/notifications.js";
import * as r32 from "../functions/api/admin-usage.js";
import * as r10 from "../functions/api/ai/suggest.js";
import * as r11 from "../functions/api/auth/login.js";
import * as r12 from "../functions/api/auth/logout.js";
import * as r13 from "../functions/api/auth/me.js";
import * as r14 from "../functions/api/auth/password.js";
import * as r15 from "../functions/api/auth/register.js";
import * as r33 from "../functions/api/auth/profile.js";
import * as r34 from "../functions/api/member-avatar.js";
import * as r35 from "../functions/api/listings/pause.js";
import * as r36 from "../functions/api/auth/account.js";
import * as r37 from "../functions/api/auth/email-verification.js";
import * as r38 from "../functions/api/admin-user-avatar/[id].js";
import * as publicMemberAvatar from "../functions/api/public-member-avatar/[id].js";
import * as r27 from "../functions/api/auth/google.js";
import * as r16 from "../functions/api/listing-photo/[id].js";
import * as r17 from "../functions/api/listings/[id]/report.js";
import * as r18 from "../functions/api/listings/[id].js";
import * as r19 from "../functions/api/listings/index.js";
import * as r20 from "../functions/api/listings/mine.js";
import * as r21 from "../functions/api/public-settings.js";
import * as r22 from "../functions/api/site-asset/[id].js";
import * as r23 from "../functions/ilan/[id].js";
import * as r24 from "../functions/kategori/[slug].js";
import * as r25 from "../functions/sehir/[slug].js";
import * as r26 from "../functions/sitemap.xml.js";

const ROUTES = [
 {path:'/api/admin-lead-radar',params:[],handlers:leadRadar},
 {path:'/api/radar',params:[],handlers:leadRadar},
 {path:'/api/admin-seo-monitor',params:[],handlers:seoMonitor},
 {path:'/api/admin-directory',params:[],handlers:directoryAdmin},
 {path:'/api/admin-listing-metrics',params:[],handlers:listingMetrics},
 {path:'/api/listing-event',params:[],handlers:listingEvent},
  {path:'/api/ai/nearby',params:[],handlers:nearbySearch},
  {path:'/api/admin-moderation',params:[],handlers:moderationAdmin},
  {path:'/api/listings/price-check',params:[],handlers:priceCheck},
  { path: '/api/saglik', params: [], handlers: health },
  { path: '/api/admin-activity', params: [], handlers: r0 },
  { path: '/api/admin-login-code', params: [], handlers: r39 },
  { path: '/api/admin-listings', params: [], handlers: r2 },
  { path: '/api/admin-login', params: [], handlers: r3 },
  { path: '/api/admin-logout', params: [], handlers: r4 },
  { path: '/api/admin-media', params: [], handlers: r5 },
  { path: '/api/admin-reports', params: [], handlers: r6 },
  { path: '/api/admin-session', params: [], handlers: r7 },
  { path: '/api/admin-settings', params: [], handlers: r8 },
  { path: '/api/admin-users', params: [], handlers: r9 },
  { path: '/api/admin-ai', params: [], handlers: r28 },
  { path: '/api/admin-ai-suggestions', params: [], handlers: r31 },
  { path: '/api/admin-usage', params: [], handlers: r32 },
  { path: '/api/ai/assistant', params: [], handlers: r29 },
  { path: '/api/ai/support', params: [], handlers: r30 },
  { path: '/api/ai/suggest', params: [], handlers: r10 },
  { path: '/api/auth/login', params: [], handlers: r11 },
  { path: '/api/auth/google', params: [], handlers: r27 },
  { path: '/api/auth/logout', params: [], handlers: r12 },
  { path: '/api/auth/me', params: [], handlers: r13 },
  { path: '/api/auth/password', params: [], handlers: r14 },
  { path: '/api/auth/register', params: [], handlers: r15 },
  { path: '/api/auth/profile', params: [], handlers: r33 },
  { path: '/api/member-avatar', params: [], handlers: r34 },
  { path: '/api/listings/pause', params: [], handlers: r35 },
  { path: '/api/auth/account', params: [], handlers: r36 },
  { path: '/api/auth/email-verification', params: [], handlers: r37 },
  { path: new RegExp("^/api/admin-user-avatar/([^/]+)$"), params: ['id'], handlers: r38 },
  { path: new RegExp("^/api/public-member-avatar/([^/]+)$"), params: ['id'], handlers: publicMemberAvatar },
  { path: '/api/listings', params: [], handlers: r19 },
  { path: '/api/listings/mine', params: [], handlers: r20 },
  { path: '/api/public-settings', params: [], handlers: r21 },
  { path: '/sitemap.xml', params: [], handlers: r26 },
  { path: new RegExp('^/sitemaps/[^/]+\\.xml$'), params: [], handlers: r26 },
  { path: new RegExp("^/api/listing-photo/([^/]+)$"), params: ['id'], handlers: r16 },
  { path: new RegExp("^/api/listings/([^/]+)/report$"), params: ['id'], handlers: r17 },
  { path: new RegExp("^/api/listings/([^/]+)$"), params: ['id'], handlers: r18 },
  { path: new RegExp("^/api/site-asset/([^/]+)$"), params: ['id'], handlers: r22 },
  { path: new RegExp("^/ilan/([^/]+)/([^/]+)$"), params: ['id', 'slug'], handlers: r23 },
  { path: new RegExp("^/ilan/([^/]+)$"), params: ['id'], handlers: r23 },
  { path: new RegExp("^/kategori/([^/]+)$"), params: ['slug'], handlers: r24 },
  { path: new RegExp("^/sehir/([^/]+)$"), params: ['slug'], handlers: r25 },
];

const API_NOT_FOUND = () => Response.json({ error: 'Uç nokta bulunamadı.' }, { status: 404 });
const BRAND_ASSETS = new Map([
  ['/favicon.ico', ['image/x-icon', faviconIco]],
  ['/favicon-96x96.png', ['image/png', faviconPng]],
  ['/apple-touch-icon.png', ['image/png', appleTouchIcon]],
]);
function brandAssetResponse(path, method) {
  if (path === '/robots.txt') {
    return new Response(method === 'HEAD' ? null : robotsTxt, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (path === '/site.webmanifest') {
    return new Response(method === 'HEAD' ? null : siteManifest, { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' } });
  }
  const asset = BRAND_ASSETS.get(path);
  if (!asset) return null;
  const bytes = Uint8Array.from(atob(asset[1]), (character) => character.charCodeAt(0));
  return new Response(method === 'HEAD' ? null : bytes, { headers: { 'content-type': asset[0], 'content-length': String(bytes.byteLength), 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
const MEMBER_NOTIFICATION_ASSETS = new Map([
  ['/hesabim/', ['text/html; charset=utf-8', memberNotificationAssets.accountHtml]],
  ['/assets/account.js', ['text/javascript; charset=utf-8', memberNotificationAssets.accountJs]],
  ['/assets/account-page.css', ['text/css; charset=utf-8', memberNotificationAssets.accountCss]],
]);
function memberNotificationAssetResponse(path, method) {
  const asset = MEMBER_NOTIFICATION_ASSETS.get(path);
  if (!asset || (method !== 'GET' && method !== 'HEAD')) return null;
  return new Response(method === 'HEAD' ? null : asset[1], {
    headers: { 'content-type': asset[0], 'cache-control': 'no-store' },
  });
}
const CSP = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://accounts.google.com https://www.googletagmanager.com 'sha256-1hItqd3GccWRmiIkzwaleHiUckcHDSRng+W7e6d0ojg='; frame-src https://challenges.cloudflare.com https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.gstatic.com https://*.google-analytics.com; connect-src 'self' https://challenges.cloudflare.com https://accounts.google.com https://*.google-analytics.com https://www.googletagmanager.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests";

function secure(response, request, isApi = false) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(self)');
  headers.set('content-security-policy', CSP);
  if (new URL(request.url).protocol === 'https:') headers.set('strict-transport-security', 'max-age=31536000');
  const path = new URL(request.url).pathname;
  const canonicalPath = path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`;
  const canonicalHref = `https://yukvinc.com.tr${canonicalPath}`;
  const publicPhoto = /^\/api\/listing-photo\//.test(path) && /public/.test(headers.get('cache-control') || '');
  const privatePage=/^\/(?:admin|yonetim|giris|ilan-ver|hesabim|yonetici-kurulum)(?:\/|$)/.test(path);
  if (path === '/gizlilik/') headers.set('x-robots-tag', 'noindex, follow');
  if ((isApi && !publicPhoto) || privatePage) headers.set('x-robots-tag', 'noindex, nofollow');
  let result = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  if (response.status === 200 && /text\/html/i.test(headers.get('content-type') || '')) {
    const rewriter=new HTMLRewriter()
      .on('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"],link[rel="manifest"]',{element(el){el.remove()}})
      .on('link[rel="canonical"]',{element(el){el.remove()}})
      .on('meta[name="robots"]',{element(el){if(privatePage)el.remove()}})
      .on('body',{element(el){el.append('<footer class="yv-social-footer"><div class="wrap"><nav aria-label="YükVinç sosyal medya"><a href="https://www.youtube.com/channel/UCNZdS_n3E7sdVSXsO8cqefA" rel="me noopener">YouTube</a><a href="https://www.instagram.com/yukvinc/" rel="me noopener">Instagram</a><a href="https://www.tiktok.com/@yuk.vinc" rel="me noopener">TikTok</a></nav></div></footer>',{html:true})}})
      .on('head',{element(el){el.append(`<link rel="canonical" href="${canonicalHref}">`+iconTags+(privatePage?'<meta name="robots" content="noindex, nofollow">':''),{html:true});if(!privatePage)el.append('<style data-analytics-styles>'+analyticsStyles+'</style><script src="/assets/analytics.js" defer></script>',{html:true})}});
    if(!privatePage)rewriter.on('link[rel="stylesheet"][href="/assets/site.css"]',{element(el){el.replace('<style data-site-styles>'+siteStyles+'</style>',{html:true})}});
    result=rewriter.transform(result);
  }
  return result;
}

const mainWorker = {
  async scheduled(controller, env, ctx) {
    if(controller.cron==='* * * * *'){
      const checkTime=new Date(controller.scheduledTime||Date.now());
      if(checkTime.getUTCHours()===6&&checkTime.getUTCMinutes()===0)ctx.waitUntil(runSeoMonitor(env,path=>application.fetch(new Request('https://yukvinc.com.tr'+path,{headers:{'user-agent':'YukVincSeoAuditBot/1.0'}}),env,ctx),{scheduled:true}).catch(()=>console.error('[seo-monitor] scheduled_failed')));
      ctx.waitUntil(syncInbox(env).catch(()=>console.error('[outreach] inbox_sync_failed')));
      ctx.waitUntil(processListingAgent(env).catch(error=>console.error('[listing-agent]',JSON.stringify({event:'scheduled_failed',name:error?.name||'Error'}))));
      ctx.waitUntil(processPublicationEmails(env).catch(error=>console.error('[owner-publication-email]',JSON.stringify({event:'scheduled_failed',name:error?.name||'Error'}))));
      ctx.waitUntil(scheduledLeadRadar(env));
      return;
    }
    ctx.waitUntil(runImprovementReview(env).catch(async error=>{try{await env.DB.prepare('INSERT INTO ai_audit(id,actor,action,outcome,metadata_json) VALUES(?,?,?,?,?)').bind(crypto.randomUUID().replaceAll('-',''),'system','improvement.review','failed',JSON.stringify({name:error?.name||'Error'})).run()}catch{}console.error('[ai-improvements]',JSON.stringify({event:'scheduled_review_failed',name:error?.name||'Error'}))}));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' || request.method === 'HEAD') {
      const brandAsset = brandAssetResponse(url.pathname, request.method);
      if (brandAsset) return secure(brandAsset, request);
    }
    const host = (request.headers.get("host") || url.hostname).toLowerCase();
    if (host === "www.yukvinc.com.tr") {
      url.hostname = "yukvinc.com.tr";
      url.protocol = "https:";
      return secure(Response.redirect(url.toString(), 301), request);
    }
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
    if (pathname === '/yonetim') {
      url.pathname = '/admin/';
      return secure(Response.redirect(url.toString(), 301), request);
    }
    if(/^\/(?:admin|yonetim|giris|ilan-ver|hesabim|yonetici-kurulum|iletisim|hakkimizda|gizlilik|kategori\/[^/]+|sehir\/[^/]+|ilan\/[^/]+(?:\/[^/]+)?)$/.test(pathname)&&url.pathname!==pathname+'/'){
      url.pathname=pathname+'/';return secure(Response.redirect(url.toString(),301),request);
    }
    for (const route of ROUTES) {
      let params = {};
      if (typeof route.path === "string") {
        if (pathname !== route.path) continue;
      } else {
        const match = pathname.match(route.path);
        if (!match) continue;
        try { params = Object.fromEntries(route.params.map((name, index) => [name, decodeURIComponent(match[index + 1])])); }
        catch { return new Response("Geçersiz adres.", { status: 400 }); }
      }
      const method = request.method.toLowerCase();
      const handler = route.handlers[`onRequest${method[0].toUpperCase()}${method.slice(1)}`] || (method === "head" ? route.handlers.onRequestGet : undefined);
      if (!handler) return secure(new Response("Method not allowed", { status: 405, headers: { allow: Object.keys(route.handlers).filter((key) => key.startsWith("onRequest")).map((key) => key.slice(8).toUpperCase()).join(", ") } }), request, pathname.startsWith('/api/'));
      const response = await handler({ request, env, params, ctx,
        ...(route.handlers===seoMonitor?{renderPublic:path=>application.fetch(new Request('https://yukvinc.com.tr'+path,{headers:{'user-agent':'YukVincSeoAuditBot/1.0'}}),env,ctx)}:{}) });
      if (request.method === "HEAD") return secure(new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers }), request, pathname.startsWith('/api/'));
      return secure(response, request, pathname.startsWith('/api/'));
    }
    if (pathname === "/api" || pathname.startsWith("/api/")) return secure(API_NOT_FOUND(), request, true);
    const adminAsset = adminPanelAssetResponse(url.pathname, request.method, adminPanelAssets);
    const memberNotificationAsset = memberNotificationAssetResponse(url.pathname, request.method);
    if (memberNotificationAsset) return secure(memberNotificationAsset, request);
    let assetResponse = adminAsset || await env.ASSETS.fetch(request);
    // Establish the local admin session on the verified top-level navigation.
    // This avoids depending on a second Access-protected XHR to finish sign-in.
    if(request.method==='GET'&&/^\/admin(?:\/|$)/.test(url.pathname)&&assetResponse.status===200&&assetResponse.headers.get('content-type')?.includes('text/html')&&request.headers.has('Cf-Access-Jwt-Assertion')){
      const session=await r7.onRequestGet({request,env,ctx});
      const cookie=session.headers.get('set-cookie');
      if(session.ok&&cookie){const headers=new Headers(assetResponse.headers);headers.append('set-cookie',cookie);headers.set('cache-control','private, no-store');headers.set('vary','Cookie');assetResponse=new Response(assetResponse.body,{status:assetResponse.status,headers});}
    }
    return secure(pathname === "/" && request.method === "GET" ? await renderHome(assetResponse, env) : assetResponse, request);
  },
};

const application=withSeoReview(withJobBoard(withSiteApp(mainWorker,siteAppAssets),jobBoardAssets),seoReviewIcon);
export default withTenderBoard(application);
