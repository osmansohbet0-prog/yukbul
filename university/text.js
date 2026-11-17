const entities={amp:'&',quot:'"',apos:"'",nbsp:' ',ccedil:'ç',Ccedil:'Ç',uuml:'ü',Uuml:'Ü',ouml:'ö',Ouml:'Ö',scedil:'ş',Scedil:'Ş',gbreve:'ğ',Gbreve:'Ğ',Idot:'İ',inodot:'ı'};
export const plainSourceText=s=>String(s||'').replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(raw,key)=>{if(key.startsWith('#')){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return Number.isInteger(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';}return entities[key]??raw;}).replace(/\s+/g,' ').trim();

export function robotsAllows(text,target,agent='YukVincLeadRadar'){
 const groups=[];let current=null,hasRules=false;
 for(const line of String(text).split(/\r?\n/)){
  const [key,...rest]=line.split('#')[0].split(':');const value=rest.join(':').trim();
  if(key.trim().toLowerCase()==='user-agent'){
   if(!current||hasRules){current={agents:[],rules:[]};groups.push(current);hasRules=false;}current.agents.push(value.toLowerCase());
  }else if(current&&['allow','disallow'].includes(key.trim().toLowerCase())){hasRules=true;if(value)current.rules.push({allow:key.trim().toLowerCase()==='allow',path:value});}
 }
 const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&agent.toLowerCase().includes(a)));
 const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 const u=new URL(target);const pathname=u.pathname+u.search;let best=null;
 for(const rule of selected.flatMap(g=>g.rules)){
  const pattern=rule.path.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replaceAll('*','.*');
  if(new RegExp('^'+pattern).test(pathname)&&(!best||rule.path.length>best.path.length||(rule.path.length===best.path.length&&rule.allow)))best=rule;
 }
 return !best||best.allow;
}