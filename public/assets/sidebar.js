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
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const matched = categories.find(([, , href]) => href.replace(/\/+$/, '') === path);
  const allActive = path === '/' || path.startsWith('/sehir/') || path.startsWith('/ilan/');
  const row = (label, href, icon, active = false) =>
    '<a class="yv-navitem' + (active ? ' is-active' : '') + '" href="' + href + '"' +
    (active ? ' aria-current="page"' : '') + '><span class="yv-icon" aria-hidden="true">' + icon +
    '</span><span>' + label + '</span></a>';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'yv-menu-toggle wrap';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'yv-sidebar');
  toggle.innerHTML = '<span aria-hidden="true">☰</span> Menü';

  const sidebar = document.createElement('aside');
  sidebar.id = 'yv-sidebar';
  sidebar.className = 'yv-sidebar';
  sidebar.setAttribute('aria-label', 'Hesap ve ilan kategorileri');
  sidebar.innerHTML =
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

  const shell = document.createElement('div');
  shell.className = 'yv-shell wrap';
  header.insertAdjacentElement('afterend', toggle);
  toggle.insertAdjacentElement('afterend', shell);
  shell.append(sidebar, main);
  main.classList.remove('wrap');

  const mobile = window.matchMedia('(max-width: 640px)');
  const syncViewport = () => {
    if (mobile.matches) {
      sidebar.hidden = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.hidden = false;
    } else {
      sidebar.hidden = false;
      toggle.hidden = true;
    }
  };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    sidebar.hidden = open;
  });
  mobile.addEventListener('change', syncViewport);
  syncViewport();
})();