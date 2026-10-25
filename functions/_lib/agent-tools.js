// This registry deliberately contains no mutation, SQL, URL-fetch or admin tools.
export const AGENT_TOOLS=Object.freeze(['listing_search','nearby_search','creation_check','support_help']);
export function validateToolCall(name,args){
 if(!AGENT_TOOLS.includes(name)||!args||typeof args!=='object'||Array.isArray(args))return false;
 const allowed={listing_search:['city','category','query'],nearby_search:['latitude','longitude','radius_km'],creation_check:['title','description','category','city','district','price_unit'],support_help:['topic']}[name];
 if(Object.keys(args).some(k=>!allowed.includes(k)))return false;
 if(name==='nearby_search')return Number.isFinite(args.latitude)&&Math.abs(args.latitude)<=90&&Number.isFinite(args.longitude)&&Math.abs(args.longitude)<=180&&(args.radius_km==null||Number.isFinite(args.radius_km)&&args.radius_km>0&&args.radius_km<=200);
 return Object.values(args).every(v=>typeof v==='string'&&v.length<=3000);
}
export function haversine(a,b){
 const rad=x=>x*Math.PI/180,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude);
 const h=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function rankNearby(items,point,radius=100){
 return items.filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)).map(x=>{const {latitude,longitude,...publicItem}=x;return{...publicItem,distance_km:Math.round(haversine(point,x)*10)/10}}).filter(x=>x.distance_km<=radius).sort((a,b)=>a.distance_km-b.distance_km);
}
