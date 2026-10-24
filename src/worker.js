// Former Pages handlers are bundled and dispatched through this single Workers entry.
import * as health from "../functions/api/saglik.js";
import * as r0 from "../functions/api/admin-activity.js";
import * as r1 from "../functions/api/admin-bootstrap.js";
import * as r2 from "../functions/api/admin-listings.js";
import * as r3 from "../functions/api/admin-login.js";
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
import * as r32 from "../functions/api/admin-usage.js";
import * as r10 from "../functions/api/ai/suggest.js";
import * as r11 from "../functions/api/auth/login.js";
import * as r12 from "../functions/api/auth/logout.js";
import * as r13 from "../functions/api/auth/me.js";
import * as r14 from "../functions/api/auth/password.js";
import * as r15 from "../functions/api/auth/register.js";
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
  { path: '/api/saglik', params: [], handlers: health },
  { path: '/api/admin-activity', params: [], handlers: r0 },
  { path: '/api/admin-bootstrap', params: [], handlers: r1 },
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
  { path: '/api/listings', params: [], handlers: r19 },
  { path: '/api/listings/mine', params: [], handlers: r20 },
  { path: '/api/public-settings', params: [], handlers: r21 },
  { path: '/sitemap.xml', params: [], handlers: r26 },
  { path: new RegExp("^/api/listing\-photo/([^/]+)$"), params: ['id'], handlers: r16 },
  { path: new RegExp("^/api/listings/([^/]+)/report$"), params: ['id'], handlers: r17 },
  { path: new RegExp("^/api/listings/([^/]+)$"), params: ['id'], handlers: r18 },
  { path: new RegExp("^/api/site\-asset/([^/]+)$"), params: ['id'], handlers: r22 },
  { path: new RegExp("^/ilan/([^/]+)/([^/]+)$"), params: ['id', 'slug'], handlers: r23 },
  { path: new RegExp("^/ilan/([^/]+)$"), params: ['id'], handlers: r23 },
  { path: new RegExp("^/kategori/([^/]+)$"), params: ['slug'], handlers: r24 },
  { path: new RegExp("^/sehir/([^/]+)$"), params: ['slug'], handlers: r25 },
];

const API_NOT_FOUND = () => Response.json({ error: 'Uç nokta bulunamadı.' }, { status: 404 });
const CSP = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://accounts.google.com 'sha256-89sM6Taoo7ugLs+JhEzm00yywDPn/XkiBZmVytoqgbY='; frame-src https://challenges.cloudflare.com https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.gstatic.com; connect-src 'self' https://challenges.cloudflare.com https://accounts.google.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests";

function secure(response, request, isApi = false) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('content-security-policy', CSP);
  if (new URL(request.url).protocol === 'https:') headers.set('strict-transport-security', 'max-age=31536000');
  const path = new URL(request.url).pathname;
  if (isApi || /^\/(?:admin|giris|ilan-ver|hesabim|yonetici-kurulum)(?:\/|$)/.test(path)) headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async scheduled(controller, env, ctx) { ctx.waitUntil(runImprovementReview(env).catch(async error=>{try{await env.DB.prepare('INSERT INTO ai_audit(id,actor,action,outcome,metadata_json) VALUES(?,?,?,?,?)').bind(crypto.randomUUID().replaceAll('-',''),'system','improvement.review','failed',JSON.stringify({name:error?.name||'Error'})).run()}catch{}console.error('[ai-improvements]',JSON.stringify({event:'scheduled_review_failed',name:error?.name||'Error'}))})); },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = (request.headers.get("host") || url.hostname).toLowerCase();
    if (host === "www.yukvinc.com.tr") {
      url.hostname = "yukvinc.com.tr";
      url.protocol = "https:";
      return secure(Response.redirect(url.toString(), 301), request);
    }
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
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
      const response = await handler({ request, env, params, ctx });
      if (request.method === "HEAD") return secure(new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers }), request, pathname.startsWith('/api/'));
      return secure(response, request, pathname.startsWith('/api/'));
    }
    if (pathname === "/api" || pathname.startsWith("/api/")) return secure(API_NOT_FOUND(), request, true);
    return secure(await env.ASSETS.fetch(request), request);
  },
};
