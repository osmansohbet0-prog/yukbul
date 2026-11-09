/* Appended to the current production script; no account or admin code is replaced. */
function yvTons(item) {
  const text = `${item.title || ''} ${item.description || ''}`.toLocaleLowerCase('tr');
  const range = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ton(?:dan)?\s*)?(?:[-–]|ve|ile)\s*(\d+(?:[.,]\d+)?)\s*ton/);
  if (range) return [Number(range[1].replace(',', '.')), Number(range[2].replace(',', '.'))].sort((a,b)=>a-b);
  const values = [...text.matchAll(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*ton(?:luk|a|dan)?\b/g)].map(m=>Number(m[1].replace(',','.')));
  return values.length ? [values[0], values[0]] : null;
}
function yvFilter(rows, filters) {
  const fold = text => String(text || '').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const unit = text => ['sefer','sefer başı','iş başı','is_basi'].includes(text) ? 'is_basi' : text;
  const number = v => v === '' || v == null ? null : Number(v);
  const min = number(filters.min_price), max = number(filters.max_price), tons = number(filters.tons);
  const results = rows.filter(x => {
    const capacity = tons == null ? null : yvTons(x);
    return (!filters.category || filters.category === 'all' || x.category === filters.category)
      && (!filters.city || fold(x.city) === fold(filters.city))
      && (!filters.district || fold(x.district) === fold(filters.district))
      && fold(filters.q).split(/\s+/).filter(Boolean).every(word => fold(`${x.title} ${x.description} ${x.city} ${x.district}`).includes(word))
      && (min == null || x.price_amount != null && Number(x.price_amount) >= min)
      && (max == null || x.price_amount != null && Number(x.price_amount) <= max)
      && (!filters.unit || filters.unit === 'all' || unit(x.price_unit) === filters.unit)
      && (tons == null || capacity && tons >= capacity[0] && tons <= capacity[1])
      && (!filters.mode || filters.mode === 'all' || (filters.mode === 'rental' ? x.category !== 'mobile_tire' && x.listing_type === 'equipment' && unit(x.price_unit) !== 'is_basi' : unit(x.price_unit) === 'is_basi'));
  });
  const rank = x => x.package_tier === 'premium' ? 2 : x.package_tier === 'featured' ? 1 : 0;
  return results.sort((a,b)=>{
    if (filters.sort === 'price-asc' || filters.sort === 'price-desc') {
      if (a.price_amount == null || b.price_amount == null) return (a.price_amount == null) - (b.price_amount == null);
      // Different fee periods are grouped, never silently converted into comparable prices.
      const group = String(unit(a.price_unit)||'').localeCompare(String(unit(b.price_unit)||''),'tr');
      return group || (filters.sort === 'price-asc' ? a.price_amount-b.price_amount : b.price_amount-a.price_amount) || String(a.id).localeCompare(String(b.id));
    }
    return (filters.sort === 'recommended' ? rank(b)-rank(a) : 0) || Number(b.created_at)-Number(a.created_at) || String(a.id).localeCompare(String(b.id));
  });
}
function yvCurrentFilters() {
  return {q:value('#q'),city:value('#city-filter'),district:value('#district-filter'),category:active,min_price:value('#min-price'),max_price:value('#max-price'),tons:value('#tonnage-filter'),unit:value('#price-unit-filter'),sort:value('#sort'),mode:activeMode};
}
function yvSetupDiscovery() {
  const panel = document.querySelector('#search-menu');
  const heading = document.querySelector('.listing-heading');
  if (!panel || !heading || document.querySelector('#yv-discovery')) return;
  document.body.classList.add('yv-discovery');
  const section = document.createElement('section');
  section.id = 'yv-discovery'; section.setAttribute('aria-label','İlan ara ve filtrele');
  section.innerHTML = '<div class="yv-search-heading"><div><span class="yv-kicker">İŞİNE UYGUN EKİPMANI BUL</span><h2>Ne arıyorsun?</h2></div><span class="yv-search-region">Türkiye geneli</span></div>';
  heading.after(section); section.append(panel); panel.hidden = false;
  const toggle = document.querySelector('#search-menu-toggle');
  toggle.setAttribute('aria-expanded','true');
  toggle.addEventListener('click',()=>{panel.hidden=false;section.scrollIntoView({behavior:'smooth',block:'start'});document.querySelector('#q').focus({preventScroll:true})});
  document.querySelector('#search-step-details').hidden=false;
  document.querySelector('#search-step-details').prepend(panel.querySelector('.search-menu-stage'));
  document.querySelector('.search-step-number')?.remove();
  const category = document.querySelector('#category-filter');
  category.options[0].textContent='Tüm kategoriler';category.querySelector('option[value=all]')?.remove();category.removeAttribute('required');
  const extra=document.createElement('div');extra.className='yv-extra-filters';
  extra.innerHTML='<label for="tonnage-filter">Tonaj (ton)<input id="tonnage-filter" type="number" min="0.1" max="10000" step="0.1" inputmode="decimal" placeholder="Örn. 35" aria-describedby="yv-capacity-help"></label><label for="min-price">En düşük ücret (₺)<input id="min-price" type="number" min="0" inputmode="numeric" placeholder="En az"></label>';
  document.querySelector('.yv-filter-row').before(extra);
  const advanced=document.createElement('details');advanced.className='yv-advanced';advanced.open=window.matchMedia('(min-width:1000px)').matches;
  advanced.innerHTML='<summary>Tonaj ve ücret filtreleri</summary><div class="yv-advanced-grid"></div>';
  const advancedGrid=advanced.querySelector('div');
  for(const selector of ['.yv-extra-filters','.yv-filter-row','.listing-modes'])advancedGrid.append(panel.querySelector(selector));
  panel.querySelector('.yv-filter-actions').before(advanced);
  const sortLabel=panel.querySelector('label[for=sort]');sortLabel.classList.add('yv-results-sort');document.querySelector('.results-head').append(sortLabel);
  const help=document.createElement('p');help.id='yv-capacity-help';help.className='yv-search-help';
  help.textContent='Tonaj, ilan metninde belirtilen kapasiteye göre eşleşir; ekipman uygunluğunu ilan sahibiyle teyit et. Fiyatlar ücret türüne göre gruplanır.';panel.append(help);
  const status=document.createElement('p');status.id='yv-search-error';status.setAttribute('role','status');panel.append(status);
  for(const [key,id] of [['min_price','#min-price'],['tons','#tonnage-filter']]) {
    const raw=new URLSearchParams(location.search).get(key);
    if(raw!==null && Number.isFinite(Number(raw)) && Number(raw)>=0) document.querySelector(id).value=raw;
  }
  // One explicit submit prevents an HTTP request on every keystroke or district initialization.
  document.querySelector('#apply-search').textContent='İlanları göster';
  panel.addEventListener('keydown',e=>{if(!e.defaultPrevented && e.key==='Enter' && e.target.matches('input')){e.preventDefault();document.querySelector('#apply-search').click()}});
  const originalSave=saveSearchUrl;
  saveSearchUrl=function(){originalSave();const url=new URL(location.href);for(const [key,id]of [['min_price','#min-price'],['tons','#tonnage-filter']]){const v=value(id);if(v)url.searchParams.set(key,v);else url.searchParams.delete(key)}history.replaceState(null,'',url.pathname+url.search+url.hash)};
  const originalReset=reset;
  reset=function(){document.querySelector('#min-price').value='';document.querySelector('#tonnage-filter').value='';refreshDistricts();originalReset();panel.hidden=false;toggle.setAttribute('aria-expanded','true')};
  // The old handlers captured reset before the override; clear the added fields first.
  for(const id of ['#reset-filters','#empty-reset']) document.querySelector(id).addEventListener('click',()=>{document.querySelector('#min-price').value='';document.querySelector('#tonnage-filter').value=''},true);
  for(const id of ['#reset-filters','#empty-reset']) document.querySelector(id).addEventListener('click',()=>{refreshDistricts();panel.hidden=false;toggle.setAttribute('aria-expanded','true')});
  document.querySelector('#apply-search').addEventListener('click',()=>{panel.hidden=false;toggle.setAttribute('aria-expanded','true');saveSearchUrl()});
  document.querySelector('#city-filter').addEventListener('change',()=>refreshDistricts());
  const originalRender=renderAppliedFilters;
  renderAppliedFilters=function(){originalRender();const summary=document.querySelector('#applied-filters');for(const [id,label]of [['#min-price','En az'],['#tonnage-filter','Tonaj']])if(value(id)){const chip=document.createElement('span');chip.textContent=label+' '+value(id)+(id==='#min-price'?' ₺':' ton');summary.append(chip);summary.hidden=false}document.querySelector('#yv-search-error').textContent=value('#min-price')&&value('#max-price')&&Number(value('#min-price'))>Number(value('#max-price'))?'En düşük ücret, en yüksek ücretten büyük olamaz.':''};
  const retry=document.createElement('button');retry.type='button';retry.className='yv-retry';retry.textContent='Sonuçları yenile';retry.addEventListener('click',()=>{saveSearchUrl();load()});document.querySelector('.results-head').append(retry);
  const originalFilter=filtered;
  filtered=function(){return yvFilter(items,yvCurrentFilters())};
  // Keep the underlying implementation available for emergency debugging without invoking it.
  void originalFilter;
  document.querySelectorAll('[data-mobile-search]').forEach(button=>button.addEventListener('click',()=>{document.querySelector('.yv-menu-close')?.click();panel.hidden=false;section.scrollIntoView({behavior:'smooth',block:'start'});document.querySelector('#q').focus({preventScroll:true})}));
}
yvSetupDiscovery();
