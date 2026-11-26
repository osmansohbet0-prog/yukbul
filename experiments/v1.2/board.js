(() => {
  const root=document.querySelector('#yv12-opportunities');
  if(!root)return;
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node};
  const link=(href,text,cls)=>{const node=el('a',text,cls);node.href=href;return node};
  const button=(text,action,cls='yv12-secondary')=>{
    const node=el('button',text,cls);node.type='button';
    node.addEventListener('click',async()=>{node.disabled=true;try{await action(node)}catch(e){status.textContent=e.message}finally{node.disabled=false}});
    return node;
  };
  const labelled=(name,input)=>{const label=el('label',name);label.append(input);return label};
  const endpoint='/api/v12/tenders',pageSize=8;
  const filters=el('details',null,'yv12-filters'),controls=el('div',null,'yv12-controls');
  const tabs=el('div',null,'yv12-switch'),city=el('select'),machine=el('select'),order=el('select'),search=el('input');
  const status=el('p','İhaleler yükleniyor…'),results=el('div',null,'yv12-results'),tip=el('p'),alerts=el('section');
  const more=button('Daha fazla göster',()=>{shown+=pageSize;render();results.children[shown-pageSize]?.querySelector('a')?.focus()},'yv12-secondary yv12-more');
  let data,mode='all',shown=pageSize;
  const views={best:'Uygun olanlar',all:'Tüm ihaleler',saved:'Kaydedilenler'};
  const normalize=value=>String(value??'').toLocaleLowerCase('tr').trim();
  const reset=()=>{shown=pageSize;render()};
  status.setAttribute('role','status');
  tip.className='fine';
  search.type='search';search.placeholder='Örn. vinç, Ankara';
  order.append(new Option('Varsayılan',''),new Option('Başvurusu yaklaşanlar','soon'),new Option('Yeni yayınlananlar','new'));
  filters.append(el('summary','Ara ve filtrele'),controls);
  const machineLabel=labelled('Makine',machine);
  controls.append(labelled('İhale ara',search),labelled('İl',city),machineLabel,labelled('Sıralama',order));
  root.append(tabs,filters,status,results,more,tip,alerts);
  tabs.hidden=filters.hidden=more.hidden=true;
  for(const input of [city,machine,order])input.addEventListener('change',reset);
  search.addEventListener('input',reset);

  async function api(path,body){
    const response=await fetch(path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
    if(!response.ok)throw Error('İşlem tamamlanamadı. Tekrar deneyin.');
    return response.json();
  }
  const date=value=>new Date(value*1000).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  function makeCard(item,top){
    const card=el('article',null,'yv12-card');
    card.append(el('h3',item.title));
    const meta=el('div',null,'yv12-meta');
    const remaining=item.deadline-Date.now()/1000;
    meta.append(el('span',[item.city,item.district].filter(Boolean).join(' / ')||'Konum belirtilmemiş'),
      el('span','Son başvuru '+date(item.deadline),remaining<=86400?'yv12-urgent':''));
    card.append(meta);
    if(top){
      const selected=data.machines.find(x=>x.id===top.machine);
      card.append(el('p',(top.band==='review'?'İnceleme gerekli':'Yüksek uyum')+' · %'+top.score+(selected?' · '+selected.title:'')));
    }
    const actions=el('div',null,'yv12-actions');
    actions.append(link(item.officialUrl||item.helpUrl,item.applicationVerified?'Resmî başvuru':item.officialUrl?'Resmî duyuru':'Başvuru bilgisi','yv12-action'));
    if(data.member){
      const save=button(item.saved?'Kaydedildi':'Kaydet',async node=>{
        await api(endpoint,{id:item.id,saved:!item.saved});
        item.saved=!item.saved;
        node.textContent=item.saved?'Kaydedildi':'Kaydet';
        node.setAttribute('aria-pressed',String(item.saved));
        if(mode==='saved'&&!item.saved){render();tabs.querySelector('[aria-pressed=true]')?.focus()}
      });
      save.setAttribute('aria-pressed',String(item.saved));
      actions.append(save);
    }
    card.append(actions);
    const details=el('details'), req=item.requirements;
    details.append(el('summary','Şartlar ve başvuru rehberi'));
    if(top){
      const reasons=el('ul');
      for(const reason of [...top.reasons,...top.missing])reasons.append(el('li',reason));
      if(reasons.children.length)details.append(reasons);
    }
    if(req.documents)details.append(el('p','Belgeler: '+req.documents));
    if(req.qualifications)details.append(el('p','Yeterlilik şartları: '+req.qualifications));
    if(!req.documents&&!req.qualifications)details.append(el('p','Belge ve yeterlilik koşullarını resmî duyurudan kontrol edin.'));
    details.append(link(item.helpUrl,'Nasıl katılırım?'));
    if(data.member)details.append(button('Yük Usta’ya sor',async node=>{
      const result=await api('/api/v12/tender-guide',{id:item.id});
      const list=el('ol');list.dataset.guide='1';
      for(const entry of result.tips)list.append(el('li',entry));
      details.querySelector('[data-guide]')?.remove();
      node.after(list);
    }));
    card.append(details);
    return card;
  }

  function render(){
    const now=Date.now()/1000, query=normalize(search.value);
    const filtered=data.opportunities.map(item=>({item,top:(item.matches||[]).filter(m=>!machine.value||m.machine===machine.value).reduce((a,b)=>!a||a.score<b.score?b:a,null)}))
      .filter(({item,top})=>item.deadline>now&&(mode!=='best'||top)&&(mode!=='saved'||item.saved)
        &&(!city.value||normalize(item.city)===city.value)&&(!query||normalize([item.title,item.city,item.district].join(' ')).includes(query)))
      .sort((a,b)=>order.value==='soon'?a.item.deadline-b.item.deadline:order.value==='new'?b.item.published-a.item.published
        :mode==='best'?b.top.score-a.top.score||a.item.deadline-b.item.deadline:b.item.published-a.item.published);
    status.textContent=filtered.length+' ihale';
    results.replaceChildren(...filtered.slice(0,shown).map(({item,top})=>makeCard(item,top)));
    if(!filtered.length){
      const message=mode==='best'&&!query&&!city.value?'Bu seçim için uygun ihale bulunamadı.':'Bu filtrede ihale bulunamadı.';
      results.append(el('p',message));
      if(mode!=='all')results.append(button('Tüm ihalelere dön',()=>choose('all')));
    }
    more.hidden=filtered.length<=shown;
  }
  function choose(view){
    mode=view;
    for(const tab of tabs.querySelectorAll('button'))tab.setAttribute('aria-pressed',String(tab.dataset.view===view));
    reset();
  }
  async function notifications(){
    const path='/api/v12/tender-alerts',prefs=await api(path),section=el('details');
    const site=el('input'),email=el('input');
    site.type=email.type='checkbox';site.checked=prefs.site;email.checked=prefs.email;
    section.append(el('summary','Bildirim ayarları'),labelled('Site içi bildirim',site),labelled('E-posta bildirimi',email),
      button('Tercihleri kaydet',async()=>{await api(path,{site:site.checked,email:email.checked});await notifications()}));
    for(const item of prefs.items)section.append(el('p',(item.read_at?'':'Yeni · ')+item.title),
      button('Okundu işaretle',async()=>{await api(path,{action:'read',id:item.id});await notifications()}));
    alerts.replaceChildren(section);
  }
  async function start(){
    data=await api(endpoint);
    const personal=data.member&&data.machines.length>0;
    tabs.replaceChildren();
    for(const [key,name] of Object.entries(views)){
      if(key==='best'&&!personal||key==='saved'&&!data.member)continue;
      const tab=button(name,()=>choose(key));tab.dataset.view=key;tabs.append(tab);
    }
    tabs.hidden=tabs.children.length<=1;filters.hidden=false;
    city.replaceChildren(new Option('Tüm iller',''));
    const cities=[...new Set(data.opportunities.map(t=>t.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
    for(const name of cities)city.append(new Option(name,normalize(name)));
    machineLabel.hidden=data.machines.length<=1;machine.replaceChildren(new Option('Tüm makineler',''));
    for(const item of data.machines)machine.append(new Option(item.title,item.id));
    tip.textContent=data.member?'Uyumluluk puanı resmî yeterlilik garantisi değildir.':'Kendi makinene uyan ihaleleri görmek için giriş yap.';
    if(data.limited)tip.append(' Bu bölüm en güncel kayıtları gösteriyor.');
    choose(personal&&data.opportunities.some(t=>t.matches?.length)?'best':'all');
    if(data.member&&root.dataset.alerts==='1')await notifications();
  }
  function load(){
    start().catch(e=>{status.textContent=e.message;results.replaceChildren(button('Tekrar dene',load))});
  }
  load();
})();
