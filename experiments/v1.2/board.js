(() => {
  const root=document.querySelector('#yv12-opportunities');
  if(!root)return;
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node};
  const endpoint='/api/v12/tenders';
  const labels={best:'Bana uygun ihaleler',all:'Tüm ihaleler',near:'Yakınımdaki ihaleler',new:'Yeni yayınlananlar',soon:'Başvurusu yaklaşanlar',saved:'Kaydedilen ihaleler'};
  const filter=el('select'),machines=el('select'),rows=el('div'),status=el('p'),alerts=el('section');
  let data,mode;
  const band={very_high:'Çok yüksek uyum',high:'Yüksek uyum',review:'İncelenmesi gerekiyor'};
  filter.setAttribute('aria-label','İhale filtresi');
  machines.setAttribute('aria-label','Makine filtresi');
  status.setAttribute('role','status');
  root.append(filter,machines,status,rows,alerts);
  async function api(path,body){
    const res=await fetch(path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
    if(!res.ok)throw Error('İhale bilgileri yüklenemedi.');
    return res.json();
  }
  function button(text,fn){
    const node=el('button',text);
    node.type='button';
    node.addEventListener('click',async()=>{node.disabled=true;try{await fn()}catch(e){status.textContent=e.message}finally{node.disabled=false}});
    return node;
  }
  const date=time=>new Date(time*1000).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'medium',timeStyle:'short'});
  const link=(href,text)=>{const node=el('a',text);node.href=href;return node};
  function render(){
    mode=filter.value;
    const selection=machines.value;
    const machineMap=new Map(data.machines.map(machine=>[machine.id,machine]));
    const cities=new Set(data.machines.filter(m=>!selection||m.id===selection).map(m=>m.city).filter(Boolean).map(x=>x.toLocaleLowerCase('tr')));
    const when=Date.now()/1000;
    const items=data.opportunities.map(item=>({...item,matches:(item.matches||[]).filter(m=>!selection||m.machine===selection).sort((a,b)=>b.score-a.score)}))
      .filter(item=>mode==='all'||mode==='best'&&item.matches.length||mode==='near'&&item.city&&cities.has(item.city.toLocaleLowerCase('tr'))
        ||mode==='new'&&item.published>=when-7*86400||mode==='soon'&&item.deadline<=when+7*86400||mode==='saved'&&item.saved)
      .sort((a,b)=>mode==='best'?b.matches[0].score-a.matches[0].score||a.deadline-b.deadline:mode==='soon'?a.deadline-b.deadline:b.published-a.published);
    rows.replaceChildren();
    if(!items.length)rows.append(el('p','Bu filtrede ihale yok.'));
    for(const item of items){
      const card=el('article'),top=item.matches[0],req=item.requirements;
      card.className='admin-row';
      card.append(el('h3',item.title),el('p',[item.city,item.district].filter(Boolean).join(' / ')||'İş konumu doğrulanamadı.'),
        el('p','Son başvuru: '+date(item.deadline)));
      if(top){
        card.append(el('p','%'+top.score+' · '+band[top.band]+' · '+machineMap.get(top.machine)?.title));
        for(const reason of top.reasons)card.append(el('p',reason));
        for(const reason of top.missing)card.append(el('p',reason));
      }
      if(item.officialUrl)card.append(link(item.officialUrl,item.applicationVerified?'Resmî başvuru':'Resmî duyuru'));
      card.append(link(item.helpUrl,'Nasıl Katılırım?'));
      if(data.member){
        card.append(button(item.saved?'Kaydı kaldır':'Kaydet',async()=>{const original=data.opportunities.find(row=>row.id===item.id);await api(endpoint,{id:item.id,saved:!original.saved});original.saved=!original.saved;render()}));
        card.append(button('Yük Usta rehberi',async()=>{
          const guidance=await api('/api/v12/tender-guide',{id:item.id});
          const block=el('div');
          for(const tip of guidance.tips)block.append(el('p',tip));
          if(req.documents)block.append(el('p','Duyuruda görülen belgeler: '+req.documents));
          if(req.qualifications)block.append(el('p','Duyuruda görülen yeterlilik: '+req.qualifications));
          if(!req.documents)block.append(el('p','Gerekli belgeler bu kayıtta doğrulanamadı.'));
          card.querySelector('[data-guide]')?.remove();
          block.dataset.guide='1';
          card.append(block);
        }));
      }
      rows.append(card);
    }
  }
  async function notifications(){
    const path='/api/v12/tender-alerts';
    const prefs=await api(path);
    const site=el('input'),email=el('input'),siteLabel=el('label','Site içi bildirim'),emailLabel=el('label','E-posta bildirimi');
    site.type=email.type='checkbox';
    site.checked=prefs.site;
    email.checked=prefs.email;
    siteLabel.prepend(site);
    emailLabel.prepend(email);
    alerts.replaceChildren(el('h3','İhale bildirimleri'),siteLabel,emailLabel,button('Tercihleri kaydet',async()=>{
      await api(path,{site:site.checked,email:email.checked});
      await notifications();
    }));
    for(const item of prefs.items)alerts.append(el('p',(item.read_at?'':'Yeni · ')+item.title),button('Okundu işaretle',async()=>{
      await api(path,{action:'read',id:item.id});
      await notifications();
    }));
  }
  filter.addEventListener('change',render);
  machines.addEventListener('change',render);
  (async()=>{
    data=await api(endpoint);
    const available=data.member&&data.machines.length;
    for(const [key,label] of Object.entries(labels)){
      if((key==='best'||key==='near')&&!available||key==='saved'&&!data.member)continue;
      filter.append(new Option(label,key));
    }
    filter.value=available?'best':'all';
    machines.hidden=!available;
    machines.append(new Option('Tüm makineler',''));
    for(const machine of data.machines)machines.append(new Option(machine.title,machine.id));
    const note=!available?'Kişiselleştirme için giriş yapıp yayındaki makine ilanlarını ekleyebilirsin.':'Uyumluluk puanı resmî katılım yeterliliğini garanti etmez.';
    status.textContent=note+(data.limited?' Bu bölüm en güncel kayıtları gösteriyor.':'');
    render();
    if(data.member&&root.dataset.alerts==='1')await notifications();
  })().catch(e=>{status.textContent=e.message});
})();
