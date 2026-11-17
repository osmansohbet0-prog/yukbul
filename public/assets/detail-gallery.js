'use strict';
// Earlier detail pages expose the same photos through thumbnail buttons.
const previous = document.querySelector('.detail-gallery');
if (previous?.querySelector('[data-gallery-main]')) {
  const main = previous.querySelector('[data-gallery-main]');
  const sources = Array.from(previous.querySelectorAll('[data-gallery-src]'), button => button.dataset.gallerySrc);
  if (!sources.length) sources.push(main.src);
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/assets/gallery.css';
  document.head.append(style);
  const controls = sources.length > 1 ? '<button data-step="-1" aria-label="Önceki fotoğraf">‹</button><output aria-live="polite"></output><button data-step="1" aria-label="Sonraki fotoğraf">›</button>' : '';
  previous.classList.add('listing-gallery');
  previous.innerHTML = '<div class="photo-strip"></div><div class="photo-controls">'+controls+'</div><dialog aria-label="Tam ekran fotoğraf"><div class="photo-stage"><img alt=""></div><div class="photo-controls">'+controls+'<button data-zoom aria-pressed="false">Yakınlaştır</button><button data-close>Kapat</button></div></dialog>';
  sources.forEach((src, index) => {
    const link = document.createElement('a');
    const img = main.cloneNode(false);
    img.removeAttribute('data-gallery-main');
    img.removeAttribute('class');
    img.src = link.href = src;
    img.loading = index ? 'lazy' : 'eager';
    img.alt = main.alt + ' · ' + (index + 1);
    link.append(img);
    previous.querySelector('.photo-strip').append(link);
  });
}
for (const gallery of document.querySelectorAll('.listing-gallery')) {
  const strip = gallery.querySelector('.photo-strip');
  const links = Array.from(strip.children);
  const dialog = gallery.querySelector('dialog');
  const stage = dialog.querySelector('.photo-stage');
  const zoom = dialog.querySelector('[data-zoom]');
  let selected = 0;
  function update(index) {
    selected = Math.max(0, Math.min(index, links.length - 1));
    for (const counter of gallery.querySelectorAll('output')) {
      counter.value = (selected + 1) + '/' + links.length;
    }
    if (dialog.open) {
      const image = stage.querySelector('img');
      image.src = links[selected].href;
      image.alt = links[selected].firstElementChild.alt;
      stage.classList.remove('zoomed');
      zoom.setAttribute('aria-pressed', 'false');
      zoom.textContent = 'Yakınlaştır';
    }
  }
  function move(step) {
    update((selected + step + links.length) % links.length);
    strip.scrollLeft = selected * strip.clientWidth;
  }
  update(0);
  strip.addEventListener('scroll', () => {
    if (!dialog.open && strip.clientWidth) update(Math.round(strip.scrollLeft / strip.clientWidth));
  }, {passive: true});
  for (const [index, link] of links.entries()) {
    link.addEventListener('click', event => {
      if (!dialog.showModal || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      dialog.showModal();
      update(index);
      dialog.querySelector('[data-close]').focus();
    });
  }
  for (const button of gallery.querySelectorAll('[data-step]')) {
    button.addEventListener('click', () => move(Number(button.dataset.step)));
  }
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => links[selected].focus({preventScroll: true}));
  zoom.addEventListener('click', () => {
    const active = stage.classList.toggle('zoomed');
    zoom.setAttribute('aria-pressed', String(active));
    zoom.textContent = active ? 'Uzaklaştır' : 'Yakınlaştır';
  });
  dialog.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  });
  let start;
  stage.addEventListener('touchstart', event => {
    start = event.touches.length === 1 ? event.touches[0] : null;
  }, {passive: true});
  stage.addEventListener('touchend', event => {
    if (!start || stage.classList.contains('zoomed')) return;
    const dx = event.changedTouches[0].clientX - start.clientX;
    const dy = event.changedTouches[0].clientY - start.clientY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
    start = null;
  }, {passive: true});
}
