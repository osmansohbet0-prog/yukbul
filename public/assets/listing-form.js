'use strict';
const $=s=>document.querySelector(s),form=$('#listing-form'),panels=[...document.querySelectorAll('[data-step]')];let step=0,photos=[];const MAX_COMPRESSED_PHOTO_BYTES=1_800_000;
const TURKISH_CITIES=["Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kilis","Kırıkkale","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Şanlıurfa","Şırnak","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak"];
const cityInput=form.elements.city,districtSelect=form.elements.district,cityMenu=$('#city-options'),cityCollator=new Intl.Collator('tr',{sensitivity:'base'});
const cityKey=v=>String(v||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('tr').replace(/ı/g,'i').trim();
function closeCities(){cityMenu.hidden=true;cityInput.setAttribute('aria-expanded','false');cityInput.removeAttribute('aria-activedescendant')}
function showCities(){const q=cityKey(cityInput.value),matches=TURKISH_CITIES.filter(c=>!q||cityKey(c).startsWith(q)).sort(cityCollator.compare);cityMenu.replaceChildren();for(const city of matches){const option=document.createElement('button');option.type='button';option.className='city-option';option.setAttribute('role','option');option.textContent=city;option.addEventListener('mousedown',e=>e.preventDefault());option.addEventListener('click',()=>{cityInput.value=city;closeCities();cityInput.dispatchEvent(new Event('change',{bubbles:true}));cityInput.focus()});cityMenu.append(option)}if(!matches.length){const empty=document.createElement('div');empty.className='city-empty';empty.textContent='Bu harflerle başlayan il bulunamadı.';cityMenu.append(empty)}cityMenu.hidden=false;cityInput.setAttribute('aria-expanded','true')}
cityInput.addEventListener('focus',showCities);cityInput.addEventListener('input',()=>{showCities();districtSelect.value='';districtSelect.disabled=true;districtSelect.replaceChildren(new Option('Önce il seç',''))});cityInput.addEventListener('change',()=>{const districts=window.YUKVINC_DISTRICTS?.[cityKey(cityInput.value)]||[];districtSelect.replaceChildren(new Option(districts.length?'İlçe seç':'İlçe listesi yüklenemedi',''));for(const name of districts)districtSelect.add(new Option(name,name));districtSelect.disabled=!districts.length});cityInput.addEventListener('keydown',e=>{const items=[...cityMenu.querySelectorAll('[role=option]')],active=items.findIndex(x=>x.getAttribute('aria-selected')==='true');if(e.key==='ArrowDown'&&items.length){e.preventDefault();const i=(active+1)%items.length;items.forEach(x=>x.setAttribute('aria-selected','false'));items[i].setAttribute('aria-selected','true');items[i].scrollIntoView({block:'nearest'})}else if(e.key==='ArrowUp'&&items.length){e.preventDefault();const i=(active<=0?items.length:active)-1;items.forEach(x=>x.setAttribute('aria-selected','false'));items[i].setAttribute('aria-selected','true');items[i].scrollIntoView({block:'nearest'})}else if(e.key==='Enter'&&!cityMenu.hidden){const selected=items.find(x=>x.getAttribute('aria-selected')==='true');if(selected){e.preventDefault();selected.click()}}else if(e.key==='Escape')closeCities()});
cityInput.addEventListener('blur',()=>setTimeout(closeCities,120));
const labels={crane:'Vinç kiralama',mobile_tire:'Mobil lastikçi / Yerinde lastik tamiri',tow:'Oto kurtarıcı / yol yardım',basket:'Sepetli platform',manlift:'Manlift kiralama',machine:'İş makinesi / forklift',lift:'Nakliyat asansörü',operator:'Operatör iş arıyor'};
function displayUnit(value){return value==='sefer'?'iş başı':value}
function note(s,bad=false){$('#listing-status').textContent=s;$('#listing-status').classList.toggle('bad',bad)}function safe(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

const STEP_GROUPS=[[0,1],[2,3],[4],[5]];
const STEP_LABELS=['Tür ve konum','İlan ve iletişim bilgileri','Zorunlu fotoğraflar','Önizleme ve onay'];
let photoProcessing=false;
const LABELS={category:'İlan türü',city:'İl',district:'İlçe',title:'İlan başlığı',description:'İlan açıklaması',contact_phone:'İletişim telefonu',price_amount:'Ücret',price_unit:'Ücret türü',privacy_ok:'Aydınlatma onayı',photos:'Fotoğraf'};
function setStep(n){
  step=Math.max(0,Math.min(n,STEP_GROUPS.length-1));
  panels.forEach((panel,index)=>{panel.hidden=!STEP_GROUPS[step].includes(index)});
  $('#step-back').hidden=step===0;
  $('#step-next').hidden=step===STEP_GROUPS.length-1;
  $('#submit-listing').hidden=step!==STEP_GROUPS.length-1;
  $('#step-title').textContent=(step+1)+' / '+STEP_GROUPS.length+' · '+STEP_LABELS[step];
  $('#step-progress').style.width=((step+1)/STEP_GROUPS.length*100)+'%';
  const status=$('#wizard-step-error');if(status)status.hidden=true;
  if(step===STEP_GROUPS.length-1)review();
}
function clearFieldError(field){
  if(!field||!field.name)return;
  field.removeAttribute('aria-invalid');
  field.closest('label')?.querySelector('.yv-field-error')?.remove();
  if(field.name==='photos')$('#photo-dropzone')?.classList.remove('yv-invalid');
}
function fieldError(field,message){
  if(field){
    field.setAttribute('aria-invalid','true');
    const label=field.closest('label')||field.parentElement;
    let error=label?.querySelector('.yv-field-error');
    if(label&&!error){error=document.createElement('span');error.className='yv-field-error';error.setAttribute('role','alert');label.append(error)}
    if(error)error.textContent=message;
    if(field.name==='photos')$('#photo-dropzone')?.classList.add('yv-invalid');
    field.focus({preventScroll:true});
    field.scrollIntoView?.({block:'center',behavior:'smooth'});
  }
  const status=$('#wizard-step-error');
  if(status){status.hidden=false;status.textContent=message}
  note(message,true);
  return false;
}
function hasRequiredPhoto(){
  const existing=$('#existing-photos')?.querySelectorAll('img').length||0;
  const removal=form.elements.remove_photos?.checked;
  return photos.length>0||Boolean(form.dataset.editId&&existing>0&&!removal);
}
function validStep(n){
  for(const panelIndex of STEP_GROUPS[n]){
    const controls=[...panels[panelIndex].querySelectorAll('input,select,textarea')].filter(x=>x.name&&!['hp','photos','remove_photos'].includes(x.name));
    for(const control of controls){
      if(control.disabled)continue;
      if(!control.checkValidity()||(control.required&&control.type!=='checkbox'&&!String(control.value||'').trim())){
        const label=LABELS[control.name]||'Bu alan';
        return fieldError(control,label+' eksik veya geçersiz. Lütfen kontrol et.');
      }
      clearFieldError(control);
    }
  }
  if(n===0){
    const city=cityInput.value.trim();
    if(!TURKISH_CITIES.includes(city))return fieldError(cityInput,'Lütfen listeden geçerli bir il seç.');
    const districts=window.YUKVINC_DISTRICTS?.[cityKey(city)]||[];
    if(!districts.includes(districtSelect.value))return fieldError(districtSelect,'İlçe seçimi geçersiz. İline uygun ilçeyi listeden seç.');
  }
  if(n===1){
    const phone=form.elements.contact_phone;
    const value=phone.value.trim();
    if((phone.required||value)&&(!/^[+0-9 ()-]+$/.test(value)||value.replace(/\D/g,'').length<10||value.length>20)){
      return fieldError(phone,'Telefon en az 10 rakam içermeli. Örnek: 05xx xxx xx xx');
    }
    if(form.elements.price_unit.value==='arayiniz'&&form.elements.price_amount.value) return fieldError(form.elements.price_amount,'Fiyat için arayınız seçildiğinde tutarı boş bırak.');
  }
  if(n===2){
    if(photoProcessing)return fieldError(photoInput,'Fotoğraflar hazırlanıyor; tamamlanmadan devam edemezsin.');
    if(!hasRequiredPhoto())return fieldError(photoInput,'En az bir gerçek fotoğraf yüklemelisin. Fotoğrafsız ilan onaya gönderilemez.');
    clearFieldError(photoInput);
  }
  if(n===3&&!form.elements.privacy_ok.checked)return fieldError(form.elements.privacy_ok,'İlanı göndermek için aydınlatma onayını işaretle.');
  return true;
}
form.addEventListener('input',event=>{if(event.target.name)clearFieldError(event.target)});
form.addEventListener('change',event=>{if(event.target.name)clearFieldError(event.target)});
function collect(){const f=form.elements,cat=f.category.value;return{category:cat,listing_type:cat==='operator'?'operator_job':'equipment',title:f.title.value,description:f.description.value,city:f.city.value,district:f.district.value,business_name:f.business_name.value.trim(),address:f.address.value,price_amount:cat==='operator'||f.price_unit.value==='arayiniz'||!f.price_amount.value?null:Number(f.price_amount.value),price_unit:f.price_unit.value,contact_phone:f.contact_phone.value}}
function review(){const x=collect();$('#review-box').innerHTML=`<h3>İlan önizlemesi</h3><p><b>${safe(x.title||'Başlığın burada görünecek')}</b></p><p>${safe(labels[x.category]||'Kategori')} · ${safe(x.city)} / ${safe(x.district)}</p><p>${safe(x.description||'Açıklama')}</p><p>${x.price_unit==='arayiniz'?'Fiyat için arayınız':x.price_amount===null?'Ücret belirtilmedi':new Intl.NumberFormat('tr-TR').format(x.price_amount)+' TL / '+safe(displayUnit(x.price_unit))}</p><p>İlan, yönetici onayı sonrası yayınlanır. İletişim bilgileri ilanı inceleyen ziyaretçilere gösterilir.</p>`}
$('#step-next').addEventListener('click',()=>{if(validStep(step)){setStep(Math.min(STEP_GROUPS.length-1,step+1));note('')}});$('#step-back').addEventListener('click',()=>setStep(Math.max(0,step-1)));
function setPhotoProgress(value,label,show=true){const box=$('#photo-upload-progress'),bar=$('#photo-upload-bar'),text=$('#photo-upload-label');if(!box)return;box.hidden=!show;if(bar)bar.value=value;if(text)text.textContent=label}
async function compress(file){
 if(file.size>100*1024*1024)throw Error('Fotoğraf 100 MB sınırını aşamaz.');
 if(!file.type.startsWith('image/'))throw Error('Fotoğraf dosyası seç.');
 let img;
 if(typeof createImageBitmap==='function'){try{img=await createImageBitmap(file)}catch{}}
 if(!img){
  img=await new Promise((resolve,reject)=>{
   const url=URL.createObjectURL(file),image=new Image();
   image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
   image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Bu fotoğraf biçimi bu tarayıcıda açılamadı. JPG, PNG veya WebP fotoğraf seçip yeniden dene.'))};
   image.src=url;
  });
 }
 try{
  const width=img.width||img.naturalWidth,height=img.height||img.naturalHeight;
  if(!width||!height||width*height>64_000_000)throw Error('Fotoğrafın çözünürlüğü bu cihazın güvenli işleme sınırını aşıyor.');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Fotoğraf düzenleyici başlatılamadı.');
  ctx.drawImage(img,0,0,width,height);
  const encode=(type,q)=>new Promise(ok=>canvas.toBlob(ok,type,q));
  let blob=null;
  for(const quality of [.90,.85,.80,.75,.70,.65,.60,.55,.50,.45,.40,.35,.30,.25]){
   blob=await encode('image/webp',quality);
   if(blob&&blob.type==='image/webp'&&blob.size<=MAX_COMPRESSED_PHOTO_BYTES)break;
  }
  if(!blob||blob.type!=='image/webp'||blob.size>MAX_COMPRESSED_PHOTO_BYTES){
   for(const quality of [.78,.68,.58,.48,.38,.28]){
    blob=await encode('image/jpeg',quality);
    if(blob&&blob.type==='image/jpeg'&&blob.size<=MAX_COMPRESSED_PHOTO_BYTES)break;
   }
  }
  if(!blob||blob.size>MAX_COMPRESSED_PHOTO_BYTES)throw Error('Fotoğraf 1,8 MB sınırının altına sıkıştırılamadı. JPG, PNG veya WebP fotoğraf seçip tekrar dene.');
  const data=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(Error('Fotoğraf okunamadı.'));r.readAsDataURL(blob)});
  const thumb=document.createElement('canvas');thumb.width=8;thumb.height=8;const thumbCtx=thumb.getContext('2d',{willReadFrequently:true});thumbCtx.drawImage(img,0,0,8,8);const px=thumbCtx.getImageData(0,0,8,8).data,luma=[];for(let i=0;i<64;i++)luma.push(.299*px[i*4]+.587*px[i*4+1]+.114*px[i*4+2]);const average=luma.reduce((a,b)=>a+b,0)/64;const bits=luma.map(value=>value>=average?'1':'0').join('');const visual_hash=BigInt('0b'+bits).toString(16).padStart(16,'0');return{mime_type:blob.type,data,visual_hash,thumbnail:await listingThumbnail(img)}
 }finally{img.close?.()}
}
const photoInput=form.elements.photos,dropzone=$('#photo-dropzone');
for(const eventName of ['dragenter','dragover'])dropzone.addEventListener(eventName,e=>{e.preventDefault();dropzone.classList.add('drag-active')});
for(const eventName of ['dragleave','drop'])dropzone.addEventListener(eventName,e=>{e.preventDefault();dropzone.classList.remove('drag-active')});
dropzone.addEventListener('drop',e=>{const files=e.dataTransfer?.files;if(!files?.length)return;try{const transfer=new DataTransfer();[...files].slice(0,3).forEach(file=>transfer.items.add(file));photoInput.files=transfer.files;photoInput.dispatchEvent(new Event('change',{bubbles:true}))}catch{note('Fotoğrafları “Dosya seç” düğmesiyle ekle.',true)}});
photoInput.addEventListener('change',async e=>{photoProcessing=true;try{
 const chosen=[...e.target.files];
 if(chosen.length>3)throw Error('Tek ilan için en fazla 3 fotoğraf seçebilirsin.');
 if(!chosen.length){photos=[];$('#photo-preview').innerHTML='';setPhotoProgress(0,'',false);return}
 photos=[];$('#photo-preview').innerHTML='';
 for(let i=0;i<chosen.length;i++){
  setPhotoProgress(Math.round(i/chosen.length*100),`Fotoğraf ${i+1}/${chosen.length} hazırlanıyor…`,true);
  photos.push(await compress(chosen[i]));
 }
 $('#photo-preview').innerHTML=photos.map((x,i)=>`<img src="${x.data}" alt="İlan fotoğrafı ${i+1} önizlemesi">`).join('');
 setPhotoProgress(100,`${photos.length} fotoğraf yüklenecek şekilde hazır.`,true);note('Fotoğraflar hazır.');
 setTimeout(()=>setPhotoProgress(100,'',false),1600)
}catch(err){photos=[];setPhotoProgress(0,'',false);e.target.value='';fieldError(photoInput,err.message)}finally{photoProcessing=false}});
function uploadListing(url,method,body){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest(),payload=JSON.stringify(body),hasPhoto=Array.isArray(body.photos)&&body.photos.length>0;if(hasPhoto)setPhotoProgress(0,'Fotoğraf sunucuya yükleniyor · 0%',true);xhr.open(method,url);xhr.withCredentials=true;xhr.setRequestHeader('content-type','application/json');xhr.upload.addEventListener('progress',e=>{if(hasPhoto&&e.lengthComputable){const percent=Math.min(100,Math.round(e.loaded/e.total*100));setPhotoProgress(percent,percent<100?`Fotoğraf sunucuya yükleniyor · ${percent}%`:'Fotoğraf yüklendi · ilan kaydediliyor…',true)}});xhr.upload.addEventListener('load',()=>{if(hasPhoto)setPhotoProgress(100,'Fotoğraf yüklendi · ilan kaydediliyor…',true)});xhr.addEventListener('load',()=>{let data;try{data=JSON.parse(xhr.responseText)}catch{data={}}if(xhr.status<200||xhr.status>=300){if(hasPhoto)setPhotoProgress(0,'',false);const message=data.message||data.error||(xhr.status===413?'Fotoğraf gönderimi sunucu sınırını aştı.':'İlan kaydedilemedi.');const labels={city:'il',district:'ilçe',business_name:'firma adı',title:'başlık',description:'açıklama',category:'kategori',contact_phone:'telefon',price_amount:'fiyat',address:'adres',privacy_ok:'aydınlatma onayı',photos:'fotoğraf'};const field=data.field&&labels[data.field]?` Alan: ${labels[data.field]}.`:'';const code=data.code?` [${data.code}]`:'';const err=Error(message+field+code);err.field=data.field;reject(err);return}resolve(data)});xhr.addEventListener('error',()=>{if(hasPhoto)setPhotoProgress(0,'',false);reject(Error('Bağlantı kesildi. İnternetini kontrol edip tekrar dene.'))});xhr.send(payload)})}
(async()=>{const r=await fetch('/api/auth/me',{credentials:'same-origin'});if(!r.ok){$('#need-login').hidden=false;return}$('#wizard').hidden=false;$('#step-user').textContent=(await r.json()).user.email;setStep(0);const id=new URLSearchParams(location.search).get('duzenle');if(id){const mine=await fetch('/api/listings/mine',{credentials:'same-origin'}).then(r=>r.json()),x=mine.items?.find(y=>y.id===id);if(!x){note('Bu ilanı düzenleme yetkin yok.',true);return}if(form.elements.remove_photos)$('#remove-photos-wrap').hidden=false;const details=await fetch('/api/listings/'+encodeURIComponent(id),{credentials:'same-origin'}).then(r=>r.json());$('#existing-photos').innerHTML=(details.photos||[]).map(url=>`<img src="${url}" alt="Mevcut ilan fotoğrafı">`).join('');for(const k of ['category','title','description','city','district','business_name','address','price_amount','price_unit','contact_phone'])if(x[k]!=null&&form.elements[k])form.elements[k].value=x[k];const savedDistrict=x.district||'';const districts=window.YUKVINC_DISTRICTS?.[cityKey(x.city)]||[];districtSelect.replaceChildren(new Option('İlçe seç',''));for(const name of districts)districtSelect.add(new Option(name,name));districtSelect.disabled=!districts.length;if(districts.includes(savedDistrict))districtSelect.value=savedDistrict;form.dataset.editId=id;form.elements.category.dispatchEvent(new Event('change',{bubbles:true}));$('#submit-listing').textContent='Değişiklikleri onaya gönder';setStep(0)}})();
form.addEventListener('change',e=>{if(e.target.name==='category'){const op=e.target.value==='operator';$('#price-unit-wrap').hidden=op;form.elements.price_amount.disabled=op;form.elements.price_unit.disabled=op;form.elements.contact_phone.required=!op;$('#phone-optional').hidden=!op}});
form.addEventListener('submit',async e=>{e.preventDefault();if(step!==STEP_GROUPS.length-1)return;for(let n=0;n<STEP_GROUPS.length;n++){setStep(n);if(!validStep(n))return}setStep(STEP_GROUPS.length-1);if(form.elements.hp.value)return;const button=$('#submit-listing');button.disabled=true;try{const body={listing:collect(),privacy_ok:form.elements.privacy_ok.checked,hp:form.elements.hp.value,...(photos.length||form.elements.remove_photos?.checked?{photos}:{})};const edit=form.dataset.editId,url=edit?'/api/listings/'+encodeURIComponent(edit):'/api/listings',d=await uploadListing(url,edit?'PATCH':'POST',body);note(d.message||'İlanın kaydedildi.');form.reset();photos=[];$('#photo-preview').innerHTML='';$('#existing-photos').innerHTML='';setPhotoProgress(0,'',false);if(edit)delete form.dataset.editId;setTimeout(()=>location.href='/hesabim/',1300)}catch(err){if(err.field){const field=form.elements[err.field];const match=STEP_GROUPS.findIndex(group=>group.some(i=>panels[i].contains(field)));if(match>=0)setStep(match);fieldError(field,err.message)}else note(err.message,true)}finally{button.disabled=false}});
$('#ai-suggest').addEventListener('click',async()=>{const text=$('#ai-note').value.trim();if(!text){$('#ai-status').textContent='Önce kısa bir not yaz.';return}try{const r=await fetch('/api/ai/suggest',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({note:text})}),d=await r.json();if(!r.ok)throw Error(d.error);form.elements.title.value=d.suggestion.title;form.elements.description.value=d.suggestion.description;form.elements.category.value=d.suggestion.category;form.elements.category.dispatchEvent(new Event('change',{bubbles:true}));$('#ai-status').textContent='Öneri alanlara aktarıldı. Kaydetmeden önce kontrol et; aynı AI kotası içerik denetiminde de kullanılır.'}catch(e){$('#ai-status').textContent=e.message;$('#ai-status').classList.add('bad')}});

// A failed price lookup never blocks submission. Personal contact fields are omitted.
let priceCheckSequence=0;
async function showPriceComparison(){
 const sequence=++priceCheckSequence,x=collect();
 let box=document.getElementById('price-comparison');
 if(!box){box=document.createElement('p');box.id='price-comparison';box.className='form-hint';box.setAttribute('role','status');form.elements.price_amount.closest('label').append(box)}
 if(!x.city||!x.category||x.category==='operator'){box.textContent='';return}
 try{const response=await fetch('/api/listings/price-check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({listing:{category:x.category,title:x.title,description:x.description,city:x.city,district:x.district,price_amount:x.price_amount,price_unit:x.price_unit}})});const d=await response.json();if(sequence===priceCheckSequence)box.textContent=response.ok?d.comparison.warning:'Fiyat karşılaştırması şu an yapılamıyor. İlanını incelemeye gönderebilirsin.'}catch{if(sequence===priceCheckSequence)box.textContent='Fiyat karşılaştırması şu an yapılamıyor. İlanını incelemeye gönderebilirsin.'}
}
for(const field of ['price_amount','price_unit','city','category','title'])form.elements[field].addEventListener('change',showPriceComparison);

form.elements.price_unit.addEventListener('change',()=>{const call=form.elements.price_unit.value==='arayiniz';form.elements.price_amount.closest('label').hidden=call;if(call)form.elements.price_amount.value=''});

form.elements.category.addEventListener('change',()=>{if(form.elements.category.value==='mobile_tire')form.elements.price_unit.value='sefer'});

async function listingThumbnail(image){
 for(const edge of [480,360,240]){const c=document.createElement('canvas'),ratio=Math.min(1,edge/Math.max(image.width,image.height));
 c.width=Math.max(1,Math.round(image.width*ratio));c.height=Math.max(1,Math.round(image.height*ratio));c.getContext('2d').drawImage(image,0,0,c.width,c.height);
 for(const quality of [.72,.55]){const data=c.toDataURL('image/webp',quality),mime_type=data.startsWith('data:image/webp;')?'image/webp':'image/png';if(data.length<20000)return{data,mime_type}}}
 return null;
}
