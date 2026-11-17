// Public direct-contact actions. Do not surface directory-imported contacts before owner consent.
export function publicContactActions(item) {
  if (item.public_source && item.public_source !== 'owner') return '';
  const id = String(item.id || '');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) return '';
  const digits = String(item.contact_phone || '').replace(/\D/g, '');
  const national = digits.length === 12 && digits.startsWith('90') ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  if (!/^[2-5]\d{9}$/.test(national)) return '';
  const call = '<a href="tel:+90' + national + '" data-metric="phone" data-listing-id="' + id + '">Ara</a>';
  const whatsapp = national.startsWith('5')
    ? '<a href="https://wa.me/90' + national + '" rel="noopener noreferrer" data-metric="whatsapp" data-listing-id="' + id + '">WhatsApp</a>'
    : '';
  return '<div class="card-contact-actions" aria-label="İlan sahibiyle iletişim">' + call + whatsapp + '</div>';
}
