export function normalizeTurkishPhone(value) {
  const raw = String(value || '').trim();
  if (!/^[+0-9 ()-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0090')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = `90${digits.slice(1)}`;
  else if (digits.length === 10) digits = `90${digits}`;
  if (digits.length !== 12 || !digits.startsWith('90')) return null;
  return digits;
}

export function phoneLinks(value) {
  const digits = normalizeTurkishPhone(value);
  return digits ? { tel: `tel:+${digits}`, whatsapp: `https://wa.me/${digits}` } : null;
}
