'use strict';
(() => {
  const main = document.querySelector('body > main');
  const header = document.querySelector('body > header');
  if (!main || !header || document.querySelector('.yv-shell')) return;

  const categories = [
    ['crane', 'Vinç', '/kategori/vinc/', '⚒'],
    ['tow', 'Oto kurtarıcı', '/kategori/oto-kurtarici/', '↗'],
    ['basket', 'Sepetli platform', '/kategori/sepetli-platform/', '▱'],
    ['manlift', 'Manlift', '/kategori/manlift/', '↟'],
    ['machine', 'İş makineleri', '/kategori/is-makinesi/', '⚙'],
    ['lift', 'Nakliyat asansörü', '/kategori/nakliyat-asansoru/', '⇧'],
    ['operator', 'Operatör iş ilanı', '/kategori/operator-is-ilanlari/', '♧']
  ];
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const matched = categories.find(([, , href]) => href.replace(/\/+$/, '') === path);
  const allActive = path === '/' || path.startsWith('/sehir/') || path.startsWith('/ilan/');
  const row = (label, href, icon, active = false) =>
    '<a class="yv-navitem' + (active ? ' is-active' : '') + '" href="' + href + '"' +
    (active ? ' aria-current="page"' : '') + '><span class="yv-icon" aria-hidden="true">' + icon +
    '</span><span>' + label + '</span></a>';

  const searchControls = path === '/' ?
    '<button type="button" id="search-menu-toggle" class="yv-navitem yv-search-toggle" aria-expanded="false" aria-controls="search-menu"><span class="yv-icon" aria-hidden="true">⌕</span><span>Ara ve filtrele</span></button>' +
    '<div id="search-menu" class="yv-search-menu" hidden>' +
      '<div class="search-menu-stage"><span class="search-step-number">01</span><label for="category-filter">Önce kategorini seç<select id="category-filter" required><option value="" selected>Kategori seç</option><option value="all">Tüm kategoriler</option><option value="crane">Vinç</option><option value="tow">Oto kurtarıcı</option><option value="basket">Sepetli platform</option><option value="manlift">Manlift</option><option value="machine">İş makinesi</option><option value="lift">Nakliyat asansörü</option><option value="operator">Operatör iş ilanı</option></select></label></div>' +
      '<div id="search-step-details" class="search-step-details" hidden>' +
        '<label for="q">Aradığın ilan<input id="q" type="search" placeholder="Örn. Gebze kiralık vinç" maxlength="100"></label>' +
        '<label for="city-filter">Şehir veya ilçe<input id="city-filter" list="city-options" placeholder="Tüm şehirler"></label>' +
        '<datalist id="city-options"><option>Konya</option><option>İstanbul</option><option>Ankara</option><option>İzmir</option><option>Bursa</option><option>Antalya</option></datalist>' +
        '<div class="yv-filter-row"><label for="price-unit-filter">Ücret türü<select id="price-unit-filter"><option value="all">Tüm ücretler</option><option value="saatlik">Saatlik</option><option value="is_basi">İş başı</option><option value="günlük">Günlük</option><option value="aylık">Aylık</option><option value="teklif">Teklif alınır</option></select></label>' +
          '<label for="max-price">En yüksek ücret<input id="max-price" type="number" min="0" placeholder="Fark etmez"></label></div>' +
        '<label for="sort">Sırala<select id="sort"><option value="recommended">Önerilen</option><option value="price-asc">Ücret: düşükten yükseğe</option><option value="price-desc">Ücret: yüksekten düşüğe</option><option value="newest">En yeni</option></select></label>' +
        '<div class="listing-modes" role="group" aria-label="İlan modeli"><button class="mode-chip active" type="button" data-listing-mode="all">Tümü</button><button class="mode-chip" type="button" data-listing-mode="rental">Kiralık</button><button class="mode-chip" type="button" data-listing-mode="job">İş başı</button></div>' +
        '<div class="yv-filter-actions"><button id="apply-search" class="button" type="button">Filtrele <span aria-hidden="true">→</span></button><button id="reset-filters" class="reset-btn" type="button">Temizle</button></div>' +
      '</div></div>'
    : row('Ara ve filtrele', '/#search-menu-toggle', '⌕');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'yv-menu-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'yv-sidebar');
  toggle.setAttribute('aria-label', 'Menüyü aç');
  toggle.innerHTML = '<span class="yv-menu-icon" aria-hidden="true"><i></i><i></i><i></i></span><span>Menü</span>';

  const sidebar = document.createElement('aside');
  sidebar.id = 'yv-sidebar';
  sidebar.className = 'yv-sidebar';
  sidebar.setAttribute('aria-label', 'Hesap ve ilan kategorileri');
  sidebar.setAttribute('aria-hidden', 'true');
  sidebar.inert = true;
  sidebar.innerHTML =
    '<button type="button" class="yv-menu-close" aria-label="Menüyü kapat">×</button>' +
    '<div class="yv-menu-group"><p class="yv-menu-label">Hesabım</p>' +
    row('Hesabım', '/hesabim/', '♙', path === '/hesabim' || path === '/giris') +
    row('İlanlarım', '/hesabim/#my-listings', '▤', path === '/hesabim') +
    '</div><div class="yv-menu-divider"></div>' +
    '<div class="yv-menu-group"><p class="yv-menu-label">Hızlı erişim</p>' +
    searchControls +
    row('Destek ve talep', '/#yukusta-support', '✦') +
    '</div><div class="yv-menu-divider"></div>' +
    '<div class="yv-menu-group"><div class="yv-menu-heading"><p class="yv-menu-label">Kategoriler</p>' +
    '<a href="/#ilanlar">Hepsi</a></div>' +
    row('Tüm ilanlar', '/#ilanlar', '⌕', allActive) +
    categories.map(([key, label, href, icon]) => row(label, href, icon, matched?.[0] === key)).join('') +
    '</div><div class="yv-account-card"><strong>İlanını doğru kişiye ulaştır</strong>' +
    '<span>Ekipmanını veya iş arayışını tek yerden yayınla.</span>' +
    '<a href="/ilan-ver/">İlan ver</a></div>';

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'yv-menu-backdrop';
  backdrop.setAttribute('aria-label', 'Menüyü kapat');
  backdrop.hidden = true;

  const shell = document.createElement('div');
  shell.className = 'yv-shell wrap';
  const nav = header.querySelector('.nav') || header;
  nav.prepend(toggle);
  if (!nav.querySelector('a[href="/ilan-ver/"]')) {
    const post=document.createElement('a');post.href='/ilan-ver/';post.className='yv-header-post';post.textContent='İlan ver';nav.append(post);
  }
  const mobileNav=document.createElement('nav');mobileNav.className='yv-mobile-nav';mobileNav.setAttribute('aria-label','Mobil hızlı erişim');
  mobileNav.innerHTML='<a href="/"'+(path==='/'?' aria-current="page"':'')+'><span aria-hidden="true">⌂</span>İlanlar</a><button type="button" data-mobile-search><span aria-hidden="true">⌕</span>Ara / Filtrele</button><a class="yv-mobile-post" href="/ilan-ver/"><span aria-hidden="true">＋</span>İlan ver</a><a href="/hesabim/"><span aria-hidden="true">♙</span>Hesabım</a>';
  document.body.append(mobileNav);
  mobileNav.querySelector('[data-mobile-search]').addEventListener('click',()=>{
    if(path!=='/'){location.href='/#search-menu-toggle';return}
    if(toggle.getAttribute('aria-expanded')!=='true')openMenu();
    const search=document.getElementById('search-menu'),button=document.getElementById('search-menu-toggle');
    if(search)search.hidden=false;if(button)button.setAttribute('aria-expanded','true');
    document.getElementById('category-filter')?.focus({preventScroll:true});
  });
  header.insertAdjacentElement('afterend', shell);
  shell.append(sidebar, main);
  main.classList.remove('wrap');
  document.body.append(backdrop);

  const mobile = window.matchMedia('(max-width: 640px)');
  const closeMenu = (restoreFocus = true) => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Menüyü aç');
    sidebar.classList.remove('is-open');
    sidebar.setAttribute('aria-hidden', 'true');
    sidebar.inert = true;
    backdrop.hidden = true;
    document.body.classList.remove('yv-menu-open');
    if (restoreFocus) toggle.focus();
  };
  const openMenu = () => {
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Menüyü kapat');
    sidebar.setAttribute('aria-hidden', 'false');
    sidebar.inert = false;
    backdrop.hidden = false;
    document.body.classList.add('yv-menu-open');
    requestAnimationFrame(() => sidebar.classList.add('is-open'));
    const firstLink = sidebar.querySelector('a');
    if (firstLink) firstLink.focus({ preventScroll: true });
  };
  const syncViewport = () => {
    if (mobile.matches) {
      toggle.hidden = false;
      sidebar.hidden = false;
      if (toggle.getAttribute('aria-expanded') === 'true') openMenu();
      else closeMenu(false);
    } else {
      toggle.hidden = true;
      sidebar.hidden = false;
      sidebar.classList.remove('is-open');
      sidebar.setAttribute('aria-hidden', 'false');
      sidebar.inert = false;
      backdrop.hidden = true;
      document.body.classList.remove('yv-menu-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  };
  toggle.addEventListener('click', () => {
    if (toggle.getAttribute('aria-expanded') === 'true') closeMenu();
    else openMenu();
  });
  sidebar.querySelector('.yv-menu-close').addEventListener('click', () => closeMenu());
  backdrop.addEventListener('click', () => closeMenu());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu();
    if(event.key==='Tab' && mobile.matches && toggle.getAttribute('aria-expanded')==='true'){
      const focusable=[...sidebar.querySelectorAll('a,button,input,select,textarea')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }
  });
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu(false)));
  mobile.addEventListener('change', syncViewport);
  syncViewport();
  const openSearchShortcut = () => {
    if (location.pathname !== '/' || location.hash !== '#search-menu-toggle') return;
    if (mobile.matches && toggle.getAttribute('aria-expanded') !== 'true') openMenu();
    const panel = document.getElementById('search-menu');
    const button = document.getElementById('search-menu-toggle');
    if (panel) panel.hidden = false;
    if (button) button.setAttribute('aria-expanded', 'true');
  };
  openSearchShortcut();
  window.addEventListener('hashchange', openSearchShortcut);
})();