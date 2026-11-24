export function stripPublicListingPhones(value) {
  let changed = false;
  const visit = item => {
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (!item || typeof item !== 'object') return;
    if (Object.prototype.hasOwnProperty.call(item, 'contact_phone')) {
      item.has_contact_phone = Boolean(item.has_contact_phone || String(item.contact_phone || '').trim());
      delete item.contact_phone;
      changed = true;
    }
    for (const child of Object.values(item)) visit(child);
  };
  visit(value);
  return { value, changed };
}

export async function redactPublicListingContacts(response) {
  if (!response || !/^application\/json\b/i.test(response.headers.get('content-type') || '')) return response;
  let payload;
  try { payload = await response.clone().json(); } catch { return response; }
  const result = stripPublicListingPhones(payload);
  if (!result.changed) return response;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(result.value), { status: response.status, statusText: response.statusText, headers });
}

export const contactPrivacyUi = String.raw`(() => {
  if (window.__yvContactPrivacyLoaded) return;
  window.__yvContactPrivacyLoaded = true;
  const contacts = new Map();
  const endpointKinds = new Set(['/api/listings', '/api/ai/assistant', '/api/ai/nearby']);
  const originalFetch = window.fetch.bind(window);
  const record = value => {
    if (Array.isArray(value)) { value.forEach(record); return; }
    if (!value || typeof value !== 'object') return;
    if (typeof value.id === 'string' && (Object.prototype.hasOwnProperty.call(value, 'has_contact_phone') || Object.prototype.hasOwnProperty.call(value, 'contact_phone'))) {
      const available = Boolean(value.has_contact_phone || String(value.contact_phone || '').trim());
      contacts.set(value.id, available);
      value.has_contact_phone = available;
      delete value.contact_phone;
    }
    Object.values(value).forEach(record);
  };
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    let url;
    try { url = new URL(typeof input === 'string' ? input : input.url, location.href); } catch { return response; }
    if (url.origin !== location.origin || !endpointKinds.has(url.pathname) || !response.ok) return response;
    try {
      const payload = await response.clone().json();
      record(payload);
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.delete('etag');
      return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
    } catch { return response; }
  };

  const listingIdFrom = element => {
    let node = element;
    for (let depth = 0; node && node !== document.body && depth < 12; depth++, node = node.parentElement) {
      if (node.matches && node.matches('a[href]')) {
        const match = node.getAttribute('href').match(/(?:^|\/)ilan\/([^/?#]+)/);
        if (match) return match[1];
      }
      if (!node.querySelectorAll) continue;
      for (const link of node.querySelectorAll('a[href]')) {
        const match = link.getAttribute('href').match(/(?:^|\/)ilan\/([^/?#]+)/);
        if (match) return match[1];
      }
    }
    return '';
  };
  const containerFor = element => element.closest('article, .listing-card, .yukusta-result-card') || element.parentElement;
  const routeUrl = (id, kind) => '/api/listings/' + encodeURIComponent(id) + '?contact=' + kind;
  const makeAction = (id, kind) => {
    const link = document.createElement('a');
    link.href = routeUrl(id, kind);
    link.textContent = kind === 'call' ? 'Ara' : 'WhatsApp';
    link.className = kind === 'call' ? 'button' : 'button secondary';
    link.setAttribute('data-contact-route', kind);
    link.setAttribute('aria-label', kind === 'call' ? 'İlan sahibini ara' : 'WhatsApp ile iletişime geç');
    if (kind === 'whatsapp') link.rel = 'noopener';
    return link;
  };
  const patch = root => {
    if (!(root instanceof Element || root instanceof Document)) return;
    const direct = [];
    if (root.matches && root.matches('a[href^="tel:"], a[href*="wa.me/"]')) direct.push(root);
    if (root.querySelectorAll) direct.push(...root.querySelectorAll('a[href^="tel:"], a[href*="wa.me/"]'));
    for (const link of direct) {
      if (link.hasAttribute('data-contact-route')) continue;
      const id = listingIdFrom(link);
      if (!id) { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); continue; }
      const kind = link.getAttribute('href').startsWith('tel:') ? 'call' : 'whatsapp';
      link.href = routeUrl(id, kind);
      link.setAttribute('data-contact-route', kind);
      if (kind === 'whatsapp') link.rel = 'noopener';
    }
    for (const link of root.querySelectorAll ? root.querySelectorAll('a[href*="/ilan/"]') : []) {
      const match = link.getAttribute('href').match(/(?:^|\/)ilan\/([^/?#]+)/);
      if (!match || contacts.get(match[1]) !== true) continue;
      const card = containerFor(link);
      if (!card || card.querySelector('[data-contact-route]')) continue;
      const actions = document.createElement('div');
      actions.className = 'yv-contact-actions';
      actions.setAttribute('aria-label', 'İlan sahibiyle iletişim');
      actions.append(makeAction(match[1], 'call'), makeAction(match[1], 'whatsapp'));
      const body = card.querySelector('.card-body, .listing-content, .yukusta-result-actions') || card;
      body.append(actions);
    }
  };
  const style = document.createElement('style');
  style.textContent = '.yv-contact-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.75rem}.yv-contact-actions a{text-decoration:none}';
  document.head.append(style);
  const observer = new MutationObserver(records => { for (const item of records) for (const node of item.addedNodes) patch(node); });
  const start = () => { patch(document); observer.observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();`;
