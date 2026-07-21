const cats=['Fashion & Clothing','Shoes','Bags & Accessories','Beauty & Cosmetics','Jewelry','Electronics','Software & Apps','Games','Books & eBooks','Courses & Education','Art & Design','Home & Living','Furniture','Food & Drinks','Pet Products','Automotive','Health & Fitness','Toys & Kids','Gifts','Handmade & Crafts','Tools & Hardware','Travel & Services','Other'];
const MAX=5*1024*1024,TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif']);let mine=[];
async function waitAuth(){if(authReady)return;if(!authReady)await new Promise(r=>document.addEventListener('launchboard:auth-ready',r,{once:true}))}
function uniqueFileName(file){
  const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
  const token=globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  return `${currentUser.id}/${Date.now()}-${token}.${ext}`;
}

function readFileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(reader.error||new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });
}

async function compressImageToDataUrl(file){
  const source=await readFileAsDataUrl(file);
  const image=new Image();

  await new Promise((resolve,reject)=>{
    image.onload=resolve;
    image.onerror=()=>reject(new Error('The selected image could not be opened.'));
    image.src=source;
  });

  const maxSide=1200;
  const scale=Math.min(1,maxSide/Math.max(image.naturalWidth||1,image.naturalHeight||1));
  const width=Math.max(1,Math.round(image.naturalWidth*scale));
  const height=Math.max(1,Math.round(image.naturalHeight*scale));
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;

  const context=canvas.getContext('2d',{alpha:false});
  context.fillStyle='#fff';
  context.fillRect(0,0,width,height);
  context.drawImage(image,0,0,width,height);

  return canvas.toDataURL('image/jpeg',.78);
}

async function upload(bucket,file){
  if(!TYPES.has(file.type))throw Error('Choose a JPG, PNG, WebP or GIF image.');
  if(file.size>MAX)throw Error('Image must be 5 MB or smaller.');
  if(!currentUser)throw Error('Your session expired. Please sign in again.');

  const path=uniqueFileName(file);

  try{
    const result=await Promise.race([
      sb.storage.from(bucket).upload(path,file,{
        contentType:file.type,
        cacheControl:'3600',
        upsert:false
      }),
      new Promise((_,reject)=>setTimeout(
        ()=>reject(new Error('IMAGE_UPLOAD_TIMEOUT')),
        20000
      ))
    ]);

    if(result?.error)throw result.error;

    const publicResult=sb.storage.from(bucket).getPublicUrl(path);
    const publicUrl=publicResult?.data?.publicUrl;
    if(!publicUrl)throw Error('The uploaded image URL was not returned.');
    return publicUrl;
  }catch(error){
    console.warn('Storage upload failed; using compressed inline image fallback.',error);

    try{
      const fallback=await compressImageToDataUrl(file);
      if(!fallback)throw Error('Image conversion failed.');
      toast('Storage was unavailable. The image was compressed and attached directly.','success');
      return fallback;
    }catch(fallbackError){
      const detail=error?.message==='IMAGE_UPLOAD_TIMEOUT'
        ? 'Image upload timed out.'
        : (error?.message||'Image upload failed.');
      throw Error(`${detail} Please try another image or publish without an image.`);
    }
  }
}

async function preview(input,img,wrap,circle=false){
  const file=input.files?.[0];
  if(!file)return;

  if(!TYPES.has(file.type)||file.size>MAX){
    input.value='';
    return toast('Choose a supported image no larger than 5 MB.');
  }

  try{
    img.src=await readFileAsDataUrl(file);
    wrap.hidden=false;
  }catch(error){
    input.value='';
    toast(error.message||'Unable to preview this image.');
  }
}


function renderDashboardIdentity(){
  const name=currentProfile?.full_name||currentProfile?.username||currentUser?.email?.split('@')[0]||'My profile';
  const nameEl=$('#dashboardIdentityName');
  const avatarEl=$('#dashboardIdentityAvatar');
  const publicLink=$('#viewPublicProfileLink');
  const mobileName=$('#mobileDashboardName');
  const mobileAvatar=$('#mobileDashboardAvatar');
  const mobilePublicLink=$('#mobileViewPublicProfileLink');
  const publicUrl=currentUser?`creator.html?id=${encodeURIComponent(currentUser.id)}`:'creator.html';

  if(nameEl)nameEl.textContent=name;
  if(mobileName)mobileName.textContent=name;
  if(publicLink)publicLink.href=publicUrl;
  if(mobilePublicLink)mobilePublicLink.href=publicUrl;

  const paintAvatar=element=>{
    if(!element)return;
    if(currentProfile?.avatar_url){
      element.innerHTML=`<img src="${esc(safeUrl(currentProfile.avatar_url,''))}" alt="">`;
    }else{
      element.textContent=name.slice(0,1).toUpperCase();
    }
  };
  paintAvatar(avatarEl);
  paintAvatar(mobileAvatar);
}

function setupDashboardProfileMenu(){
  const identity=$('#dashboardIdentity');
  const menu=$('#dashboardProfileMenu');
  if(!identity||!menu)return;

  identity.addEventListener('click',()=>{
    menu.hidden=!menu.hidden;
    identity.setAttribute('aria-expanded',String(!menu.hidden));
  });

  $('#editCreatorProfileButton')?.addEventListener('click',()=>{
    menu.hidden=true;
    identity.setAttribute('aria-expanded','false');
    const editor=$('#creatorProfileEditor');
    if(editor){
      editor.hidden=false;
      editor.scrollIntoView({behavior:'smooth',block:'start'});
      window.setTimeout(()=>$('#profileForm input[name="full_name"]')?.focus(),350);
    }
  });


  $('#mobileEditCreatorProfileButton')?.addEventListener('click',()=>{
    const editor=$('#creatorProfileEditor');
    if(editor){
      editor.hidden=false;
      editor.scrollIntoView({behavior:'smooth',block:'start'});
      window.setTimeout(()=>$('#profileForm input[name="full_name"]')?.focus(),350);
    }
  });

  $('#closeCreatorProfileEditor')?.addEventListener('click',()=>{
    const editor=$('#creatorProfileEditor');
    if(editor)editor.hidden=true;
    window.scrollTo({top:0,behavior:'smooth'});
  });

  $('#dashboardLogoutButton')?.addEventListener('click',async()=>{
    const {error}=await sb.auth.signOut();
    if(error)return toast(error.message);
    location.href='index.html';
  });

  document.addEventListener('click',event=>{
    if(!menu.hidden&&!event.target.closest('.dashboard-head-actions')){
      menu.hidden=true;
      identity.setAttribute('aria-expanded','false');
    }
  });
}

function openPublishFromMobileNavigation(){
  const params=new URLSearchParams(location.search);
  if(params.get('publish')==='1'){
    window.setTimeout(()=>openProduct(),250);
  }
}


function profileIsComplete(){
  return Boolean(currentProfile?.full_name&&currentProfile?.username&&currentProfile?.bio&&currentProfile?.avatar_url);
}

function renderDesktopDashboardExperience(){
  const desktop=document.querySelector('.dashboard-desktop-live');
  if(!desktop)return;
  const name=currentProfile?.full_name||currentProfile?.username||currentUser?.email?.split('@')[0]||'Creator';
  const hasProducts=mine.length>0;
  const profileComplete=profileIsComplete();
  const hasWebsite=Boolean(currentProfile?.website_url);
  const publicUrl=currentUser?`creator.html?id=${encodeURIComponent(currentUser.id)}`:'creator.html';
  const quickView=$('#quickViewProfile');
  if(quickView)quickView.href=publicUrl;

  const welcomeTitle=$('#dashboardWelcomeTitle');
  const welcomeCopy=$('#dashboardWelcomeCopy');
  const primary=$('#desktopPrimaryAction');
  if(hasProducts){
    if(welcomeTitle)welcomeTitle.textContent=`Keep growing, ${name}`;
    if(welcomeCopy)welcomeCopy.textContent=`You have ${mine.length} product${mine.length===1?'':'s'} live. Keep your storefront fresh and respond to buyer interest.`;
    if(primary)primary.textContent='+ Add another product';
  }else{
    if(welcomeTitle)welcomeTitle.textContent=`Welcome, ${name}`;
    if(welcomeCopy)welcomeCopy.textContent='Your creator workspace is ready. Publish your first product to start appearing in the marketplace.';
    if(primary)primary.textContent='+ Add your first product';
  }

  const checklist=[
    {label:'Creator account ready',done:true,action:null},
    {label:'Complete your creator profile',done:profileComplete,action:'profile'},
    {label:'Publish your first product',done:hasProducts,action:'product'},
    {label:'Add your website or shop link',done:hasWebsite,action:'profile'}
  ];
  const doneCount=checklist.filter(item=>item.done).length;
  const progressText=$('#setupProgressText');
  const progressBar=$('#setupProgressBar');
  if(progressText)progressText.textContent=`${doneCount} of ${checklist.length}`;
  if(progressBar)progressBar.style.width=`${Math.round(doneCount/checklist.length*100)}%`;
  const list=$('#creatorChecklist');
  if(list)list.innerHTML=checklist.map((item,index)=>`<button type="button" class="creator-checklist-item ${item.done?'is-done':''}" data-setup-action="${item.action||''}" ${item.done&&!item.action?'disabled':''}><span class="creator-check-icon">${item.done?'✓':index+1}</span><span>${esc(item.label)}</span>${item.action&&!item.done?'<small>Complete</small>':''}</button>`).join('');

  const activity=$('#dashboardRecentActivity');
  if(activity){
    const rows=[];
    if(mine[0])rows.push({icon:'▣',title:`${mine[0].title} is live`,copy:`${mine[0].views||0} views · ${mine[0].clicks||0} clicks`,href:`product.html?id=${mine[0].id}`});
    if(profileComplete)rows.push({icon:'✓',title:'Creator profile is ready',copy:'Buyers can see a complete storefront.',href:publicUrl});
    else rows.push({icon:'◎',title:'Complete your creator profile',copy:'Add an avatar and bio to improve trust.',action:'profile'});
    if(!hasProducts)rows.unshift({icon:'＋',title:'Publish your first product',copy:'Add an image, price, and product link.',action:'product'});
    rows.push({icon:'↗',title:'Share your storefront',copy:'Open your public profile and copy its link.',href:publicUrl});
    activity.innerHTML=rows.slice(0,3).map(row=>row.href?`<a class="dashboard-activity-row" href="${row.href}"><span>${row.icon}</span><div><strong>${esc(row.title)}</strong><small>${esc(row.copy)}</small></div><b>›</b></a>`:`<button type="button" class="dashboard-activity-row" data-activity-action="${row.action}"><span>${row.icon}</span><div><strong>${esc(row.title)}</strong><small>${esc(row.copy)}</small></div><b>›</b></button>`).join('');
  }
}

function openProfileEditor(){
  const editor=$('#creatorProfileEditor');
  if(editor){
    editor.hidden=false;
    editor.scrollIntoView({behavior:'smooth',block:'start'});
    window.setTimeout(()=>$('#profileForm input[name="full_name"]')?.focus(),350);
  }
}

function setupDesktopDashboardActions(){
  $('#desktopPrimaryAction')?.addEventListener('click',()=>openProduct());
  $('#quickAddProduct')?.addEventListener('click',()=>openProduct());
  $('#quickEditProfile')?.addEventListener('click',openProfileEditor);
  $('#creatorChecklist')?.addEventListener('click',event=>{
    const action=event.target.closest('[data-setup-action]')?.dataset.setupAction;
    if(action==='product')openProduct();
    if(action==='profile')openProfileEditor();
  });
  $('#dashboardRecentActivity')?.addEventListener('click',event=>{
    const action=event.target.closest('[data-activity-action]')?.dataset.activityAction;
    if(action==='product')openProduct();
    if(action==='profile')openProfileEditor();
  });
}

async function load(){await waitAuth();if(!currentUser)return location.href='index.html';const [a,p]=await Promise.all([sb.rpc('creator_analytics'),sb.from('products').select('*').eq('owner_id',currentUser.id).order('created_at',{ascending:false})]);if(p.error)return toast(p.error.message);mine=p.data||[];const d=a.data||{};$('#analytics').innerHTML=Object.entries({
  Products:d.products||mine.length,
  Views:d.views||0,
  Likes:d.likes||0,
  Followers:d.followers||0
}).map(([label,value])=>`
  <div class="card stat-card v8-stat-card">
    <strong>${Number(value||0).toLocaleString()}</strong>
    <span>${label}</span>
  </div>`).join('');$('#myProducts').innerHTML=mine.map(x=>`
    <article class="dashboard-product-card">
      <a class="dashboard-product-image" href="product.html?id=${x.id}" aria-label="Open ${esc(x.title)}">
        ${x.image_url
          ? `<img src="${esc(safeUrl(x.image_url,''))}" alt="${esc(x.title)}">`
          : '<div class="dashboard-product-placeholder">No image</div>'}
      </a>
      <div class="dashboard-product-content">
        <span class="dashboard-product-category">${esc(x.category||'Product')}</span>
        <h3>${esc(x.title)}</h3>
        <div class="dashboard-product-stats">
          <span>${x.views||0} views</span>
          <span>${x.clicks||0} clicks</span>
          ${x.is_premium?'<span>Premium</span>':''}
        </div>
        <div class="dashboard-product-actions">
          <a class="btn btn-ghost" href="product.html?id=${x.id}">Open</a>
          <button class="btn btn-soft" data-edit="${x.id}">Edit</button>
          <button class="btn btn-danger" data-delete="${x.id}">Delete</button>
        </div>
      </div>
    </article>`).join('')||'<div class="card empty-state"><p>No products yet.</p></div>';fillProfile();renderDashboardIdentity();renderDesktopDashboardExperience()}
function fillProfile(){if(!currentProfile)return;for(const k of ['full_name','username','bio','website_url','location'])$('#profileForm').elements[k].value=currentProfile[k]||'';$('#avatarUrl').value=currentProfile.avatar_url||'';if(currentProfile.avatar_url){$('#avatarPreview').src=currentProfile.avatar_url;$('#avatarPreviewWrap').hidden=false}}
async function saveProfile(e){e.preventDefault();const f=new FormData(e.target),file=f.get('avatar_file');let url=$('#avatarUrl').value||null;try{if(file?.size)url=await upload('avatars',file);const {error}=await sb.rpc('update_my_profile',{p_full_name:f.get('full_name'),p_username:f.get('username'),p_bio:f.get('bio'),p_avatar_url:url,p_website_url:f.get('website_url'),p_location:f.get('location')});if(error)throw error;toast('Profile updated.','success');await refreshIdentity();fillProfile();const editor=$('#creatorProfileEditor');if(editor)editor.hidden=true}catch(x){toast(x.message)}}
function openProduct(p=null){const f=$('#productForm');f.reset();f.elements.product_id.value=p?.id||'';for(const k of ['title','creator','price','category','product_type','brand','country','product_url','description'])if(p)f.elements[k].value=p[k]||'';f.elements.tags.value=p?.tags?.join(', ')||'';f.elements.image_url.value=p?.image_url||'';$('#productModalTitle').textContent=p?'Edit product':'Publish a product';$('#saveProduct').textContent=p?'Save changes':'Publish immediately';$('#productImagePreviewWrap').hidden=!p?.image_url;if(p?.image_url)$('#productImagePreview').src=p.image_url;$('#titleCount').textContent=f.elements.title.value.length;$('#productModal').showModal()}
async function saveProduct(e){
  e.preventDefault();

  const form=e.target;
  const data=new FormData(form);
  const file=data.get('image_file');
  const id=data.get('product_id');
  const saveButton=$('#saveProduct');
  let image=data.get('image_url')||null;

  if(!currentUser){
    toast('Your session expired. Please sign in again.');
    return;
  }

  saveButton.disabled=true;
  const originalLabel=saveButton.textContent;
  saveButton.textContent=file?.size?'Uploading image…':'Publishing…';

  try{
    if(file?.size){
      image=await upload('product-images',file);
      saveButton.textContent='Publishing…';
    }

    const item={
      title:String(data.get('title')||'').trim(),
      creator:String(data.get('creator')||'').trim(),
      price:String(data.get('price')||'').trim()||'View price',
      category:data.get('category'),
      product_type:data.get('product_type'),
      brand:String(data.get('brand')||'').trim()||null,
      country:String(data.get('country')||'').trim()||null,
      image_url:image,
      product_url:String(data.get('product_url')||'').trim(),
      description:String(data.get('description')||'').trim(),
      tags:String(data.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean),
      updated_at:new Date().toISOString()
    };

    if(!item.title)throw Error('Enter a product title.');
    if(!item.product_url)throw Error('Enter the product link.');

    const query=id
      ? sb.from('products').update(item).eq('id',id).eq('owner_id',currentUser.id)
      : sb.from('products').insert({...item,owner_id:currentUser.id});

    const {error}=await query;
    if(error)throw error;

    $('#productModal').close();
    toast(id?'Product updated.':'Product is live.','success');
    await load();
  }catch(error){
    console.error('Product publish failed:',error);
    const message=error?.message==='Failed to fetch'
      ? 'Network upload failed. Check your connection and try again. You can also publish without an image.'
      : (error?.message||'The product could not be published.');
    toast(message);
  }finally{
    saveButton.disabled=false;
    saveButton.textContent=originalLabel;
  }
}

async function remove(id){const p=mine.find(x=>x.id===id);if(!confirm(`Delete "${p?.title||'this product'}" permanently?`))return;const {error}=await sb.from('products').delete().eq('id',id).eq('owner_id',currentUser.id);if(error)return toast(error.message);toast('Product deleted.','success');load()}
window.addEventListener('DOMContentLoaded',()=>{setupDashboardProfileMenu();setupDesktopDashboardActions();openPublishFromMobileNavigation();cats.forEach(c=>$('#productCategory').insertAdjacentHTML('beforeend',`<option>${esc(c)}</option>`));$('#openSubmit').onclick=()=>openProduct();$('#closeProductModal').onclick=()=>$('#productModal').close();$('#profileForm').onsubmit=saveProfile;$('#productForm').onsubmit=saveProduct;$('#avatarFile').onchange=()=>preview($('#avatarFile'),$('#avatarPreview'),$('#avatarPreviewWrap'));$('#productImageFile').onchange=()=>preview($('#productImageFile'),$('#productImagePreview'),$('#productImagePreviewWrap'));$('#productForm').elements.title.oninput=e=>$('#titleCount').textContent=e.target.value.length;$('#myProducts').onclick=e=>{const eb=e.target.closest('[data-edit]'),db=e.target.closest('[data-delete]');if(eb)openProduct(mine.find(x=>x.id===eb.dataset.edit));if(db)remove(db.dataset.delete)};load()});