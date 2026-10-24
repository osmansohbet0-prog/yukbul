export const PACKAGE_TIERS={standard:0,featured:1,premium:2};
export function cleanPackageTier(value,fallback='standard'){return Object.hasOwn(PACKAGE_TIERS,String(value||''))?String(value):fallback}
export function tierRank(value){return PACKAGE_TIERS[cleanPackageTier(value)]}
export function tierLabel(value){return value==='premium'?'Premium · Öne Çıkan':value==='featured'?'Öne Çıkan':'Standart'}
