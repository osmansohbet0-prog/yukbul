const ORIGINAL_SCRIPT_PATH = "/assets/site.js";
const OPTIMIZED_SCRIPT_PATH = "/assets/site-optimized.js";
const SCRIPT_VERSION = "20261108-cache1";
const DUPLICATE_LOAD = /refreshDistricts\(new URLSearchParams\(location\.search\)\.get\('district'\)\s*\|\|\s*''\);\s*load\(\);/g;
const SINGLE_LOAD = "const savedDistrict=new URLSearchParams(location.search).get('district')||'';refreshDistricts(savedDistrict);if(savedDistrict)load();";

export function dedupeDistrictInitialization(source) {
  const matches = source.match(DUPLICATE_LOAD)?.length || 0;
  if (matches !== 1) return { source, changed: false, matches };
  return { source: source.replace(DUPLICATE_LOAD, SINGLE_LOAD), changed: true, matches };
}

function withHeader(response, name, value) {
  const headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function rewriteHomepage(request, env) {
  const response = await env.YUKBUL.fetch(request);
  if (response.status !== 200 || !/text\/html/i.test(response.headers.get("content-type") || "")) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  const rewritten = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  return new HTMLRewriter()
    .on('script[src*="/assets/site.js"]', {
      element(element) {
        const src = element.getAttribute("src");
        if (!src) return;
        let parsed;
        try {
          parsed = new URL(src, "https://yukvinc.com.tr");
        } catch {
          return;
        }
        if (parsed.origin !== "https://yukvinc.com.tr" || parsed.pathname !== ORIGINAL_SCRIPT_PATH) return;
        element.setAttribute("src", `${OPTIMIZED_SCRIPT_PATH}?v=${SCRIPT_VERSION}`);
      },
    })
    .transform(rewritten);
}

async function serveOptimizedScript(request, env) {
  const upstreamUrl = new URL(request.url);
  upstreamUrl.pathname = ORIGINAL_SCRIPT_PATH;
  const upstreamRequest = new Request(upstreamUrl, request);
  const response = await env.YUKBUL.fetch(upstreamRequest);
  if (response.status !== 200 || request.method === "HEAD") return response;

  const source = await response.text();
  const result = dedupeDistrictInitialization(source);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("content-type", "application/javascript; charset=utf-8");
  headers.set("cache-control", "public, max-age=86400");
  return new Response(result.source, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" && ["GET", "HEAD"].includes(request.method)) {
      if (request.method === "HEAD") return env.YUKBUL.fetch(request);
      return rewriteHomepage(request, env);
    }
    if (url.pathname === OPTIMIZED_SCRIPT_PATH && ["GET", "HEAD"].includes(request.method)) {
      return serveOptimizedScript(request, env);
    }
    return new Response("Bulunamadı.", { status: 404 });
  },
};
