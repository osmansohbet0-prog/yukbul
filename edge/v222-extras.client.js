/* Additive YükVinç V222 experience — no base page replacements. */
(()=>{'use strict';
if(window.__yv2Ready)return;window.__yv2Ready=true;document.documentElement.dataset.yv2Script='loaded';
const BASE='/api/yukusta-v2',APK='https://github.com/osmansohbet0-prog/yukbul/releases/download/yukvinc-android-v0.6.0/YukVinc-Android-0.6.0.apk';
const e=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const add=(node,tag,cls,txt)=>{const n=e(tag,cls,txt);node.append(n);return n};
const scroll=node=>{node.scrollTop=node.scrollHeight};
function start(){
 document.documentElement.dataset.yv2Start='run';
 const link=e('link');link.id='yv2-css';link.rel='stylesheet';link.href='/assets/yv-v222-extras.css?v=1';document.head.append(link);
 if(location.pathname==='/')document.getElementById('yv-buyer-cta-v191')?.remove();
 if(location.pathname.startsWith('/hesabim'))apkCard();
 if(location.pathname.startsWith('/is-talepleri')||location.pathname.startsWith('/ihale-duyurulari'))tenderBadge();
 if(location.pathname.startsWith('/admin'))return;
 createChat();
 if(document.getElementById('yv2-chat'))document.getElementById('yv2-float')?.style.setProperty('display','none','important');
 document.documentElement.dataset.yv2Start='complete';
}
function apkCard(){
 const target=document.getElementById('account-view')||document.querySelector('main');
 if(!target||document.getElementById('yv2-apk'))return;
 const card=e('section','yv2-app-card');card.id='yv2-apk';
 const copy=add(card,'div');
 add(copy,'strong',null,'📲 YükVinç Android uygulaması');
 add(copy,'p',null,'Sürüm 0.6.0 · Resmî GitHub APK dosyası');
 const anchor=add(card,'a',null,'Uygulamayı indir');
 anchor.href=APK;anchor.target='_blank';anchor.rel='noopener noreferrer';
 const listingAnchor=target.querySelector('#my-listings');if(listingAnchor?.parentElement)listingAnchor.parentElement.insertBefore(card,listingAnchor);else target.prepend(card);
}
async function tenderBadge(){
 try{
  const response=await fetch(BASE+'/tenders',{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)return;
  const data=await response.json();
  const recent=Number(data.new_count||0)>0;
  // One small badge on the existing tab, never an additional top-of-page ribbon.
  function updateTabs(){
   document.getElementById('yv2-tender-top')?.remove();
   for(const link of document.querySelectorAll('.offer-tabs a[href*="ihale-duyurulari"], nav a[href*="ihale-duyurulari"]')){
    if(link.closest('#yv2-chat'))continue;
    const tab=link.closest('.offer-tabs');
    if(tab){
     link.classList.add('yv2-tender-tab');
     // Preserve the existing clickable route while keeping the tab short.
     const label=link.querySelector('.yv2-tender-new');
     const actual=link.textContent.replace(/Yeni (ihale|eklendi)/gi,'').trim();
     if(!actual.startsWith('İhaleler'))link.textContent='İhaleler';
     else if(label&&label.textContent!=='Yeni ihale')label.remove();
    }
    link.querySelectorAll('.yv2-tender-badge,.yv2-tender-stars,.yv2-tender-star').forEach(n=>n.remove());
    const badge=link.querySelector('.yv2-tender-new');
    if(recent){
     if(!badge)add(link,'span','yv2-tender-new','Yeni ihale');
     else if(badge.textContent!=='Yeni ihale')badge.textContent='Yeni ihale';
     link.setAttribute('aria-label','İhaleler, yeni ihale var');
    }else{
     badge?.remove();
     link.removeAttribute('aria-label');
    }
   }
  }
  const sorted=(Array.isArray(data.items)?data.items:[])
   .filter(x=>x&&typeof x.title==='string'&&Number(x.published_at)>0)
   .sort((a,b)=>Number(b.published_at)-Number(a.published_at));
  const canon=v=>String(v||'').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim();
  const exactUrl=v=>{try{return new URL(v,location.origin).href.replace(/#.*$/,'').replace(/\/$/,'')}catch{return''}};
  const byUrl=new Map(sorted.filter(x=>x.source_url).map(x=>[exactUrl(x.source_url),x]));
  const matchCard=node=>{
   const key=node.dataset?.leadId||node.dataset?.tenderId||node.dataset?.id;
   if(key){const byId=sorted.find(x=>String(x.id)===key);if(byId)return byId}
   for(const link of node.querySelectorAll('a[href]')){
    const byLink=byUrl.get(exactUrl(link.href));
    if(byLink)return byLink;
   }
   const txt=canon(node.textContent);
   if(!txt||txt.length>4000)return null;
   return sorted.find(x=>canon(x.title).length>=16&&txt.includes(canon(x.title)))||null;
  };
  function prioritizeTenderCards(){
   if(!location.pathname.startsWith('/ihale-duyurulari'))return;
   const nodes=[...document.querySelectorAll('.tender-card,.ihale-card,.radar-card,.job-card,article[data-lead-id],article[data-tender-id],article,li[data-id]')];
   const matched=nodes.filter(n=>n.parentElement&&matchCard(n));
   const groups=new Map();
   for(const node of matched){
    const parent=node.parentElement;
    const entries=groups.get(parent)||[];
    if(!entries.includes(node))entries.push(node);
    groups.set(parent,entries);
   }
   for(const [parent,entries] of groups){
    if(entries.length<2)continue;
    const before=[...parent.children];
    const positions=new Set(entries);
    const candidates=entries.slice().sort((a,b)=>Number(matchCard(b)?.published_at||0)-Number(matchCard(a)?.published_at||0));
    let k=0;
    const target=before.map(n=>positions.has(n)?candidates[k++]:n);
    if(target.every((n,i)=>n===before[i]))continue;
    for(let i=0;i<target.length;i++){
     if(parent.children[i]!==target[i])parent.insertBefore(target[i],parent.children[i]||null);
    }
   }
   // Mark only verified recent published tenders; never infer from a raw record date.
   for(const node of matched){
    const item=matchCard(node);
    if(item?.is_new)node.dataset.yv2NewTender='true';
    else delete node.dataset.yv2NewTender;
   }
  }
  function apply(){updateTabs();prioritizeTenderCards()}
  apply();
  let queued=false;
  const observer=new MutationObserver(()=>{
   if(queued)return;
   queued=true;
   requestAnimationFrame(()=>{queued=false;apply()});
  });
  const root=document.getElementById('app')||document.querySelector('main')||document.body;
  observer.observe(root,{subtree:true,childList:true});
  setTimeout(()=>observer.disconnect(),90000);
 }catch{}
}
function createChat(){
 if(document.getElementById('yv2-chat'))return;
 const old=document.getElementById('yukusta-widget');if(old)old.style.setProperty('display','none','important');
 const root=e('div');root.id='yv2-chat';
 const open=add(root,'button','yv2-launch');open.type='button';open.setAttribute('aria-expanded','false');
 add(open,'span','yv2-mark','✦');add(open,'span',null,'Yük Usta ile sohbet');
 const panel=add(root,'section','yv2-panel');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Yük Usta sohbet');
 const head=add(panel,'div','yv2-head');add(head,'span','yv2-mark','✦');
 const info=add(head,'div');add(info,'div','yv2-name','Yük Usta');add(info,'div','yv2-sub','Sohbet et · İlan bul · Şikâyet bildir');
 const actions=add(head,'div','yv2-head-right');
 const reset=add(actions,'button',null,'Yeni sohbet');reset.type='button';
 const close=add(actions,'button',null,'×');close.type='button';close.setAttribute('aria-label','Sohbeti kapat');
 const messages=add(panel,'div','yv2-messages');messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');
 const tools=add(panel,'div','yv2-tools');
 const complaint=add(panel,'form','yv2-report');complaint.hidden=true;
 const reportLabel=add(complaint,'label',null,'Şikâyetini veya sorununu anlat');
 const reportText=add(reportLabel,'textarea');reportText.name='report';reportText.rows=4;reportText.minLength=12;reportText.maxLength=2000;reportText.required=true;reportText.placeholder='İlgili ilanı ve sorunu yaz (en az 12 karakter).';
 const reportActions=add(complaint,'div','yv2-report-actions');
 const cancel=add(reportActions,'button',null,'Vazgeç');cancel.type='button';
 const reportSubmit=add(reportActions,'button',null,'Şikâyeti gönder');reportSubmit.type='submit';
 const form=add(panel,'form','yv2-send-form');const row=add(form,'div','yv2-compose');
 const input=add(row,'textarea');input.name='message';input.rows=1;input.maxLength=600;input.placeholder='Yük Usta’ya yaz...';input.required=true;input.setAttribute('aria-label','Mesaj yaz');
 const send=add(row,'button','yv2-send','Gönder');send.type='submit';
 add(form,'p','yv2-fine','Özel bilgilerini gönderme. Yapay zekâ hatalı yanıt verebilir.');
 document.body.append(root);
 let history=[],busy=false,controller=null;
 function bubble(kind,text){
  const b=add(messages,'div','yv2-bubble '+(kind==='user'?'yv2-from-user':'yv2-from-agent'),text);
  scroll(messages);return b;
 }
 function show(opened){panel.hidden=!opened;open.hidden=opened;open.setAttribute('aria-expanded',String(opened));if(opened){scroll(messages);input.focus()}else open.focus()}
 function welcome(){messages.replaceChildren();bubble('assistant','Selam! Ben Yük Usta. 🙂 İstersen sohbet edelim, sana uygun vinci bulalım veya bir sorunu birlikte çözelim.')}
 function showReport(prefill){
  complaint.hidden=false;form.hidden=true;tools.hidden=true;
  reportText.value=(prefill||'').slice(0,2000);reportText.focus();scroll(messages);
 }
 function hideReport(){complaint.hidden=true;form.hidden=false;tools.hidden=false;input.focus()}
 function cards(items){
  if(!Array.isArray(items)||!items.length)return;
  const wrapper=add(messages,'div','yv2-cards');
  for(const item of items.slice(0,3)){
   const id=String(item.id||'');if(!/^[A-Za-z0-9_-]{6,90}$/.test(id))continue;
   const link=add(wrapper,'a','yv2-result');link.href='/ilan/'+encodeURIComponent(id)+'/';
   add(link,'strong',null,String(item.title||'İlanı gör').slice(0,120));
   const txt=String(item.city||'')+(item.district?' · '+String(item.district):'')+(Number(item.price_amount)>0?' · '+Number(item.price_amount).toLocaleString('tr-TR')+' TL':'');
   add(link,'small',null,txt);
  }
  if(!wrapper.children.length)wrapper.remove();scroll(messages);
 }
 function pending(value){busy=value;send.disabled=value;input.disabled=value;send.textContent=value?'…':'Gönder'}
 const shortcuts=[['Vinç bul','Kiralık vinç arıyorum.'],['İş ilanları','İş ilanlarına nasıl teklif veririm?'],['İhaleler','Yeni ihaleleri nereden görebilirim?'],['Şikâyet',null]];
 for(const [label,value] of shortcuts){
  const b=add(tools,'button',null,label);b.type='button';
  b.addEventListener('click',()=>{if(value===null){showReport();return}if(!busy){input.value=value;form.requestSubmit()}});
 }
 open.addEventListener('click',()=>show(true));close.addEventListener('click',()=>show(false));
 panel.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();complaint.hidden?show(false):hideReport()}});
 reset.addEventListener('click',()=>{controller?.abort();controller=null;pending(false);history=[];reportText.value='';hideReport();welcome()});
 cancel.addEventListener('click',hideReport);
 input.addEventListener('input',()=>{input.style.height='43px';input.style.height=Math.min(110,input.scrollHeight)+'px'});
 input.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();if(!busy)form.requestSubmit()}});
 form.addEventListener('submit',async ev=>{
  ev.preventDefault();const msg=input.value.trim();if(!msg||msg.length>600||busy)return;
  bubble('user',msg);input.value='';input.style.height='43px';pending(true);
  const typing=bubble('assistant','Yük Usta yazıyor…');typing.classList.add('yv2-typing');
  controller=new AbortController();const timer=setTimeout(()=>controller.abort(),22000);
  try{
   const r=await fetch(BASE+'/chat',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({message:msg,history:history.slice(-6)})});
   const d=await r.json();if(!r.ok)throw Error(d.message||d.error||'Yanıt alınamadı.');
   typing.textContent=String(d.answer||'Şu an doğru yanıtı bulamadım. Bir daha sorabilir misin?').slice(0,1400);
   typing.classList.remove('yv2-typing');history.push({role:'user',content:msg.slice(0,600)},{role:'assistant',content:typing.textContent.slice(0,600)});history=history.slice(-8);
   cards(d.listings);
   if(d.complaint_suggestion){const b=add(messages,'button',null,'Şikâyet formunu aç');b.type='button';b.style.cssText='align-self:flex-start;border-radius:11px;border:1px solid #bed3dd;background:white;padding:9px 12px;cursor:pointer';b.addEventListener('click',()=>showReport(msg))}
  }catch(error){typing.textContent=error.name==='AbortError'?'Yanıt gecikti. Yeniden deneyebilirsin.':'Şu an yanıt veremiyorum: '+String(error.message||'Tekrar dene.').slice(0,140);typing.classList.remove('yv2-typing')}
  finally{clearTimeout(timer);controller=null;pending(false);scroll(messages);input.focus()}
 });
 complaint.addEventListener('submit',async ev=>{
  ev.preventDefault();const message=reportText.value.trim();
  if(message.length<12||message.length>2000){reportText.reportValidity();return}
  reportSubmit.disabled=true;reportSubmit.textContent='Kaydediliyor…';
  try{
   const r=await fetch(BASE+'/report',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({message})});
   const d=await r.json();if(!r.ok)throw Error(d.message||d.error||'Şikâyet kaydedilemedi.');
   reportText.value='';hideReport();bubble('assistant','Şikâyetini kaydettim. Yönetici inceleyecek. Takip numarası: '+String(d.reference||'').slice(0,60));
  }catch(err){bubble('assistant','Şikâyet kaydedilemedi. '+String(err.message||'Tekrar dene.').slice(0,160))}
  finally{reportSubmit.disabled=false;reportSubmit.textContent='Şikâyeti gönder';scroll(messages)}
 });
 welcome();
 if(location.pathname==='/yukusta/'||location.pathname==='/yukusta')show(true);
 function openHash(){
  if(location.hash==='#yukusta-chat'){show(true)}
  if(location.hash==='#yukusta-support'){show(true);showReport()}
 }
 window.addEventListener('hashchange',openHash);openHash();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();