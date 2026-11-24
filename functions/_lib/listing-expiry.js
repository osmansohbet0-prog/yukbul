export function calculatePublicationExpiry({trialExpiresAt,paidUntil,days,now=Math.floor(Date.now()/1000)}) {
  if (!Number.isInteger(days) || days===0 || Math.abs(days)>3650) {
    throw new RangeError('Süre değişimi -3650 ile +3650 gün arasında tam sayı olmalıdır.');
  }
  const current=Math.max(Number(trialExpiresAt)||0,Number(paidUntil)||0);
  const base=days>0&&current<=now?now:(current||now);
  return Math.max(0,base+days*86400);
}
