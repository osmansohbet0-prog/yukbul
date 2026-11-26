(() => {
  const root=document.querySelector('#yv12-guardian');
  if(!root)return;
  const output=root.querySelector('[data-guardian-report]');
  const button=root.querySelector('button');
  const labels={database:'Veritabanı',radar_sources:'İhale kaynakları',tenders:'Yayımlanan ihaleler',matches:'Eşleşmeler',tender_mail:'Mevcut ihale e-postaları',renewals:'İlan yenilemeleri'};
  const date=n=>n?new Date(n*1000).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'Ölçülmedi';
  function line(text){
    const p=document.createElement('p');
    p.textContent=text;
    output.append(p);
  }
  button.addEventListener('click',async()=>{
    button.disabled=true;
    output.textContent='Yükleniyor…';
    try{
      const response=await fetch('/admin/api/v12/guardian',{cache:'no-store'});
      if(!response.ok)throw Error('Yönetici oturumu veya sağlık verileri doğrulanamadı.');
      const data=await response.json();
      output.replaceChildren();
      line(data.version+' · Geri dönüş: '+data.rollback);
      if(!data.checks.length)line('İlk zamanlanmış sağlık kontrolü bekleniyor.');
      for(const check of data.checks)line((labels[check.service]||check.service)+' · '+({ok:'Çalışıyor',degraded:'Aksıyor',failed:'Hata',unknown:'Ölçülmedi'}[check.state])+' · '+check.detail+' · '+check.response_ms+' ms · '+date(check.checked_at));
      for(const source of data.sources)line(source.name+' · '+(source.last_scan_status||'Henüz taranmadı')+' · Son başarı: '+date(source.last_success_at));
      for(const item of data.incidents)line((item.resolved_at?'Kapandı':'Açık')+' · '+(labels[item.service]||item.service)+' · '+date(item.opened_at)+' · '+item.detail+' '+item.remedy);
    }catch(e){output.textContent=e.message}
    finally{button.disabled=false}
  });
})();
