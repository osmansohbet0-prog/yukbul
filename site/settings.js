import {$,db,esc,sanitizedImage,toast,friendly} from './common.js';
export const settingLabels={headline:'Ana sayfa başlığı',introduction:'Tanıtım',announcement:'Duyuru',phone:'Telefon',whatsapp:'WhatsApp numarası',email:'İletişim e-postası',address:'Adres',about_text:'Hakkımızda',faq_text:'Sıkça sorulan sorular',privacy_text:'Gizlilik metni',terms_text:'Kullanım koşulları',primary_color:'Ana renk'};
const assetKeys={banner_path:'Manşet görseli',logo_path:'Logo',favicon_path:'Favicon'};
function asset(path){return path&&/^brand\/[a-f0-9-]+\.webp$/.test(path)?db.storage.from('site-assets').getPublicUrl(path).data.publicUrl:'';}
export async function loadSiteSettings(){
 if(!db)return;
 const r=await db.from('SiteSettings').select('*').eq('id','main').single();if(r.error)return;
 const s=r.data;
 for(const [key,id] of Object.entries({headline:'site-headline',introduction:'site-introduction',announcement:'announcement-text'}))if(s[key]&&$(id))$(id).textContent=s[key];
 if($('announcement'))$('announcement').hidden=!s.announcement;
 if(/^#[0-9a-f]{6}$/i.test(s.primary_color))document.documentElement.style.setProperty('--site-primary',s.primary_color);
 if(s.banner_path&&$('site-introduction')){const img=document.createElement('img');img.src=asset(s.banner_path);img.alt='YükBul';img.className='cms-banner';$('site-introduction').after(img);}
 if(s.logo_path){const logo=document.querySelector('.logo');if(logo){const img=document.createElement('img');img.src=asset(s.logo_path);img.alt='YükBul';img.className='cms-logo';logo.prepend(img);}}
 if(s.favicon_path){const link=document.createElement('link');link.rel='icon';link.href=asset(s.favicon_path);document.head.append(link);}
 const footer=document.querySelector('footer');if(!footer)return;
 const block=document.createElement('div');block.className='wrap cms-contact';
 for(const key of ['phone','whatsapp','email','address'])if(s[key]){const line=document.createElement('p');line.textContent=settingLabels[key]+': '+s[key];block.append(line);}
 for(const key of ['about_text','faq_text','privacy_text','terms_text'])if(s[key]){const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent=settingLabels[key];const p=document.createElement('p');p.className='preview-box';p.textContent=s[key];details.append(summary,p);block.append(details);}
 footer.append(block);
 // Existing legal links consume the authoritative settings too.
 window.dispatchEvent(new CustomEvent('yb-settings',{detail:s}));
}
export async function renderSettings(){
 const r=await db.from('SiteSettings').select('*').eq('id','main').single();if(r.error)throw r.error;const original=r.data;
 $('admin-results').innerHTML=`<form id="settings-form" class="settings-grid">${Object.entries(settingLabels).map(([key,label])=>`<div class="formrow"><label for="s-${key}">${label}</label>${key==='primary_color'?`<input id="s-${key}" type="color" value="${esc(original[key])}">`:`<textarea id="s-${key}" rows="${key.endsWith('_text')?7:2}" maxlength="${key.endsWith('_text')?20000:key==='headline'?160:key==='address'?500:key==='email'?254:['phone','whatsapp'].includes(key)?30:1000}">${esc(original[key])}</textarea>`}</div>`).join('')}${Object.entries(assetKeys).map(([key,label])=>`<div class="formrow"><label for="s-${key}">${label} (en fazla 3 MB)</label>${asset(original[key])?`<img class="cms-preview" src="${esc(asset(original[key]))}" alt="${label}">`:''}<input type="file" id="s-${key}" accept="image/png,image/jpeg,image/webp"><label><input type="checkbox" id="remove-${key}"> Görseli kaldır</label></div>`).join('')}<div class="formrow"><p class="page-note">Değişiklikler tüm ziyaretçilere yayımlanır. Metinler kod çalıştırmadan güvenli biçimde görüntülenir.</p><button class="btn primary">Değişiklikleri yayımla</button><p id="settings-message" role="status"></p></div></form>`;
 $('settings-form').onsubmit=async e=>{
  e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;const uploads=[];let saved=false;
  try{
   const payload=Object.fromEntries(Object.keys(settingLabels).map(k=>[k,$('s-'+k).value.trim()]));
   for(const key of Object.keys(assetKeys)){
    payload[key]=$('remove-'+key).checked?'':original[key];const file=$('s-'+key).files[0];
    if(file){const path=`brand/${crypto.randomUUID()}.webp`;const image=await sanitizedImage(file);const u=await db.storage.from('site-assets').upload(path,image,{contentType:'image/webp'});if(u.error)throw u.error;uploads.push(path);payload[key]=path;}
   }
   const q=await db.from('SiteSettings').update(payload).eq('id','main').select('id').single();if(q.error)throw q.error;saved=true;
   toast('Site içerikleri yayımlandı.');await renderSettings();
  }catch(error){if(!saved&&uploads.length)await db.storage.from('site-assets').remove(uploads);$('settings-message').textContent=friendly(error);}
  finally{b.disabled=false;}
 };
}
