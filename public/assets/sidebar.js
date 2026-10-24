'use strict';
(() => {
  const main = document.querySelector('body > main');
  const header = document.querySelector('body > header');
  if (!main || !header || document.querySelector('.yv-shell')) return;

  const categories = [
    ['crane', 'Vinç', '/kategori/vinc/', '⚒'],
    ['tow', 'Oto kurtarıcı', '/kategori/oto-kurtarici/', '↗'],
    ['basket', 'Sepetli platform', '/kategori/sepetli-platform/', '▱'],
    ['machine', 'İş makineleri', '/kategori/is-makinesi/', '⚙'],
    ['lift', 'Nakliyat asansörü', '/kategori/nakliyat-asansoru/', '⇧'],
    ['operator', 'Operatör iş ilanı', '/kategori/operator-is-ilanlari/', '♧']
  ];
  const path = location.pathname.replace(/\\/+$/, '') || '/';
  const matched = categories.find(([, , href]) => href.replace(/\\/+$/, '') === path);
  const allActive = path === '/' || path.startsWith('/sehir/') || path.startsWith('/ilan/');
  const row = (label, href, icon, active = false) =>
    '<a class="yv-navitem' + (active ? ' is-active' : '') + '" href="' + href + '"' +
    (active ? ' aria-current="page"' : '') + '><span class="yv-icon" aria-hidden="true">' + icon +
    '</span><span>' + label + '</span></a>';

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
  nav.insertAdjacentElement('afterend', shell);
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
  });
  sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu(false)));
  mobile.addEventListener('change', syncViewport);
  syncViewport();
})();