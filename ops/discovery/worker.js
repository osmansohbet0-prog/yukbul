import client from './client.txt';
import css from './discovery.txt';
const VERSION='20261109-discovery1';
export function enhanceScript(source){
  // Abort the enhancement if upstream contracts change; serve the working original instead.
  if(!source.includes('function filtered()')||!source.includes('function refreshDistricts(')||!source.includes('function renderAppliedFilters()'))return {source,changed:false};
  source=source.replace(/refreshDistricts\(new URLSearchParams\(location\.search\)\.get\('district'\)\s*\|\|\s*''\);\s*load\(\);/g,"const savedDistrict=new URLSearchParams(location.search).get('district')||'';refreshDistricts(savedDistrict);if(savedDistrict&&items.length)render();");
  source=source.replace(/^for\(const id of \['#q','#city-filter','#district-filter','#max-price'\]\).*$/m,'');
  const style="if(!document.querySelector('style[data-yv-discovery]')){const style=document.createElement('style');style.setAttribute('data-yv-discovery','');style.textContent="+JSON.stringify(css)+";document.head.append(style)}";
  return {source:source+'\n'+style+'\n'+client,changed:true};
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(!['GET','HEAD'].includes(request.method))return env.YUKBUL.fetch(request);
  if(url.pathname==='/assets/site-optimized.js'||url.pathname==='/assets/site.js'){
    const originalPath=url.pathname;
    url.pathname='/assets/site.js';
    const response=await env.YUKBUL.fetch(new Request(url,request));
    if(response.status!==200||request.method==='HEAD')return response;
    const original=await response.text();
    // Old HTML must receive the old script during percentage rollout and rollback.
    const result=originalPath==='/assets/site.js'||url.searchParams.get('v')===VERSION?enhanceScript(original):{source:original.replace(/refreshDistricts\(new URLSearchParams\(location\.search\)\.get\('district'\)\s*\|\|\s*''\);\s*load\(\);/g,"const savedDistrict=new URLSearchParams(location.search).get('district')||'';refreshDistricts(savedDistrict);if(savedDistrict)load();"),changed:false};
    const headers=new Headers(response.headers);
    for(const name of ['content-length','content-encoding','etag','last-modified'])headers.delete(name);
    headers.set('content-type','application/javascript; charset=utf-8');
    // Revalidate during rollout so a rollback takes effect without waiting a day.
    headers.set('cache-control','public, max-age=0, must-revalidate');
    headers.set('x-yv-discovery',result.changed?VERSION:'upstream-fallback');
    return new Response(result.source,{status:response.status,headers});
  }
  const response=await env.YUKBUL.fetch(request);
  if(url.pathname!=='/'||response.status!==200||request.method==='HEAD'||!/text\/html/i.test(response.headers.get('content-type')||''))return response;
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');
  headers.set('cache-control','no-store');headers.set('x-yv-discovery',VERSION);
  return new HTMLRewriter()
    .on('script[src*="/assets/site.js"]',{element(el){const src=new URL(el.getAttribute('src'),'https://yukvinc.com.tr');if(src.origin==='https://yukvinc.com.tr'&&src.pathname==='/assets/site.js')el.setAttribute('src','/assets/site-optimized.js?v='+VERSION)}})
    .on('head',{element(el){el.append('<style data-yv-discovery>'+css+'</style>',{html:true})}})
    .transform(new Response(response.body,{status:response.status,headers}));
}};
