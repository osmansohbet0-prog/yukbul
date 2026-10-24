(() => {
'use strict';
const ID='G-4ZZEYS46BS', KEY='yukvinc-analytics-consent-v1';
const path=location.pathname;
if(!(/^\/$/.test(path)||/^\/(ilan|kategori|sehir|hakkimizda)(\/|$)/.test(path)))return;
let started=false;
function start(){
 if(started)return;started=true;window['ga-disable-'+ID]=false;
 window.dataLayer=window.dataLayer||[];
 window.gtag=function(){window.dataLayer.push(arguments)};
 gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 gtag('js',new Date());
 const safePath=path.replace(/[^a-zA-Z0-9/_-]/g,'');
 let ref='';try{ref=new URL(document.referrer).origin}catch{}
 gtag('config',ID,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
 gtag('event','page_view',{page_location:location.origin+safePath,page_referrer:ref,page_title:path==='/'?'YükVinç':('YükVinç · '+(path.split('/')[1]||'Sayfa'))});
 const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+ID;document.head.append(script);
}
function saved(){try{return localStorage.getItem(KEY)}catch{return null}}
function choose(value){try{localStorage.setItem(KEY,value)}catch{}panel.remove();if(value==='granted'){start();return}window['ga-disable-'+ID]=true;if(window.gtag)gtag('consent','update',{analytics_storage:'denied'});for(const cookie of document.cookie.split(';')){const name=cookie.split('=')[0].trim();if(!/^_ga(?:_|$)/.test(name))continue;for(const domain of ['',location.hostname,'.'+location.hostname])document.cookie=name+'=; Max-Age=0; path=/'+(domain?'; domain='+domain:'')}if(started)location.reload()}
const panel=document.createElement('aside');panel.className='analytics-consent';panel.setAttribute('aria-label','İsteğe bağlı ziyaret ölçümü');
const message=document.createElement('p');message.textContent='Siteyi geliştirmek için izninle Google Analytics kullanıyoruz. Reklam kişiselleştirme kapalıdır. ';
const policy=document.createElement('a');policy.href='/gizlilik/';policy.textContent='Gizlilik';message.append(policy);panel.append(message);
for(const [label,value]of [['Kabul et','granted'],['Reddet','denied']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>choose(value));panel.append(button)}
const choice=saved();if(choice==='granted')start();else if(!choice)document.body.append(panel);
const footer=document.querySelector('footer');
if(footer){const button=document.createElement('button');button.type='button';button.textContent='Çerez tercihlerim';button.className='analytics-preferences';button.addEventListener('click',()=>{if(!panel.isConnected)document.body.append(panel);panel.querySelector('button').focus()});footer.append(button)}
})();