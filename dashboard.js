const cats=['Fashion & Clothing','Shoes','Bags & Accessories','Beauty & Cosmetics','Jewelry','Electronics','Software & Apps','Games','Books & eBooks','Courses & Education','Art & Design','Home & Living','Furniture','Food & Drinks','Pet Products','Automotive','Health & Fitness','Toys & Kids','Gifts','Handmade & Crafts','Tools & Hardware','Travel & Services','Other'];
const PRODUCT_BUCKET='product-images';
const MAX_IMAGE_BYTES=5*1024*1024;
const MAX_TITLE_LENGTH=80;
const ALLOWED_IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif']);
let creatorProducts=[];

async function loadDashboard(){
  if(!currentUser)return location.href='index.html';
  const [a,p,n]=await Promise.all([
    sb.rpc('creator_analytics'),
    sb.from('products').select('*').eq('owner_id',currentUser.id).order('created_at',{ascending:false}),
    sb.from('notifications').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(12)
  ]);

  if(p.error)toast(p.error.message);
  creatorProducts=p.data||[];

  const d=a.data||{};
  $('#analytics').innerHTML=Object.entries({
    Products:d.products||0,Views:d.views||0,Clicks:d.clicks||0,Likes:d.likes||0,
    Followers:d.followers||0,Reviews:d.reviews||0
  }).map(([k,v])=>`<div class="card stat-card"><span class="muted">${k}</span><strong>${v}</strong></div>`).join('');

  $('#myProducts').innerHTML=creatorProducts.map(x=>`
    <div class="review product-management-row">
      <div class="product-management-info">
        <strong>${esc(x.title)}</strong>
        <div class="muted">${x.views||0} views · ${x.clicks||0} clicks ${x.is_premium?'· Premium':''}</div>
      </div>
      <div class="row product-management-actions">
        <a class="btn btn-ghost" href="product.html?id=${encodeURIComponent(x.id)}">Open</a>
        <button class="btn btn-ghost" type="button" data-edit-product="${x.id}">Edit</button>
        <button class="btn btn-danger" type="button" data-delete-product="${x.id}">Delete</button>
      </div>
    </div>`).join('')||'<p>No products yet.</p>';

  $('#notifications').innerHTML=(n.data||[]).map(x=>`<a class="card notice ${x.is_read?'':'unread'}" href="${esc(x.link||'#')}"><strong>${esc(x.title)}</strong><p class="muted">${esc(x.body)}</p></a>`).join('')||'<p class="muted">No notifications.</p>';

  fillProfile();
  await sb.from('notifications').update({is_read:true}).eq('user_id',currentUser.id).eq('is_read',false);
}

function fillProfile(){
  if(!currentProfile)return;
  for(const k of ['full_name','username','bio','avatar_url','website_url','location']){
    $('#profileForm').elements[k].value=currentProfile[k]||'';
  }
}

async function saveProfile(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const {error}=await sb.rpc('update_my_profile',{
    p_full_name:f.get('full_name'),
    p_username:f.get('username'),
    p_bio:f.get('bio'),
    p_avatar_url:f.get('avatar_url'),
    p_website_url:f.get('website_url'),
    p_location:f.get('location')
  });
  if(error)return toast(error.message);
  toast('Profile updated.');
  setTimeout(()=>location.reload(),500);
}

function safeFileName(name){
  const ext=(name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  return `${crypto.randomUUID()}.${ext}`;
}

async function uploadProductImage(file){
  if(!ALLOWED_IMAGE_TYPES.has(file.type))throw new Error('Please select a JPG, PNG, WebP, or GIF image.');
  if(file.size>MAX_IMAGE_BYTES)throw new Error('The image is larger than 5 MB.');

  const objectPath=`${currentUser.id}/${Date.now()}-${safeFileName(file.name)}`;
  const {error}=await sb.storage.from(PRODUCT_BUCKET).upload(
    objectPath,file,{cacheControl:'3600',upsert:false,contentType:file.type}
  );
  if(error)throw error;

  const {data}=sb.storage.from(PRODUCT_BUCKET).getPublicUrl(objectPath);
  if(!data?.publicUrl)throw new Error('The image uploaded, but a public URL could not be created.');
  return data.publicUrl;
}

function openCreateProduct(){
  const form=$('#productForm');
  form.reset();
  $('#editingProductId').value='';
  $('#productModalTitle').textContent='Publish a product';
  $('#saveProductButton').textContent='Publish immediately';
  $('#cancelProductEdit').hidden=true;
  $('#productUploadStatus').textContent='';
  clearImagePreview();
  updateProductTitleCount();
  $('#productModal').showModal();
}

function openEditProduct(productId){
  const product=creatorProducts.find(x=>x.id===productId);
  if(!product)return toast('Product not found.');

  const form=$('#productForm');
  form.reset();
  $('#editingProductId').value=product.id;
  form.elements.title.value=product.title||'';
  form.elements.creator.value=product.creator||'';
  form.elements.price.value=product.price||'';
  form.elements.category.value=product.category||'';
  form.elements.product_type.value=product.product_type||'Physical';
  form.elements.brand.value=product.brand||'';
  form.elements.country.value=product.country||'';
  form.elements.image_url.value=product.image_url||'';
  form.elements.product_url.value=product.product_url||'';
  form.elements.description.value=product.description||'';
  form.elements.tags.value=Array.isArray(product.tags)?product.tags.join(', '):(product.tags||'');

  $('#productModalTitle').textContent='Edit product';
  $('#saveProductButton').textContent='Save changes';
  $('#cancelProductEdit').hidden=false;
  $('#productUploadStatus').textContent=product.image_url
    ? 'Current image will be kept unless you upload a replacement.'
    : '';
  showRemoteImagePreview(product.image_url);
  updateProductTitleCount();
  $('#productModal').showModal();
}

async function saveProduct(e){
  e.preventDefault();
  if(!currentUser)return toast('Please log in first.');

  const form=e.target;
  const button=$('#saveProductButton');
  const status=$('#productUploadStatus');
  const f=new FormData(form);
  const productId=String(f.get('product_id')||'').trim();
  const existing=productId?creatorProducts.find(x=>x.id===productId):null;
  const file=f.get('image_file');
  let imageUrl=String(f.get('image_url')||'').trim()||existing?.image_url||null;

  try{
    button.disabled=true;
    button.textContent=productId?'Saving…':'Publishing…';

    if(file instanceof File && file.size>0){
      status.textContent='Uploading replacement image…';
      imageUrl=await uploadProductImage(file);
    }else if(imageUrl){
      try{
        const parsed=new URL(imageUrl);
        if(!['http:','https:'].includes(parsed.protocol))throw new Error();
      }catch{
        throw new Error('The image URL is not valid. Use a direct HTTPS image URL or upload a file.');
      }
    }

    const productTitle=String(f.get('title')||'').trim();
    if(!productTitle)throw new Error('Product title is required.');
    if(productTitle.length>MAX_TITLE_LENGTH){
      throw new Error(`Product title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
    }

    const item={
      title:productTitle,
      creator:String(f.get('creator')||'').trim(),
      price:String(f.get('price')||'').trim()||'View price',
      category:f.get('category'),
      product_type:f.get('product_type'),
      brand:String(f.get('brand')||'').trim()||null,
      country:String(f.get('country')||'').trim()||null,
      image_url:imageUrl,
      product_url:String(f.get('product_url')||'').trim(),
      description:String(f.get('description')||'').trim(),
      tags:String(f.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean),
      updated_at:new Date().toISOString()
    };

    status.textContent=productId?'Saving changes…':'Saving product…';
    let result;
    if(productId){
      result=await sb.from('products')
        .update(item)
        .eq('id',productId)
        .eq('owner_id',currentUser.id)
        .select('id')
        .single();
    }else{
      result=await sb.from('products')
        .insert({...item,owner_id:currentUser.id})
        .select('id')
        .single();
    }
    if(result.error)throw result.error;

    toast(productId?'Product updated.':'Product is live.');
    closeProductModal();
    await loadDashboard();
  }catch(error){
    console.error(error);
    status.textContent='';
    toast(error.message||'Could not save the product.');
  }finally{
    button.disabled=false;
    button.textContent=productId?'Save changes':'Publish immediately';
  }
}

async function deleteProduct(productId){
  const product=creatorProducts.find(x=>x.id===productId);
  if(!product)return toast('Product not found.');

  const confirmed=window.confirm(
    `Delete "${product.title}"?\n\nThis permanently removes the product, its likes, and its reviews.`
  );
  if(!confirmed)return;

  const button=document.querySelector(`[data-delete-product="${CSS.escape(productId)}"]`);
  if(button){
    button.disabled=true;
    button.textContent='Deleting…';
  }

  const {error}=await sb.from('products')
    .delete()
    .eq('id',productId)
    .eq('owner_id',currentUser.id);

  if(error){
    if(button){
      button.disabled=false;
      button.textContent='Delete';
    }
    return toast(error.message);
  }

  toast('Product deleted.');
  await loadDashboard();
}

function closeProductModal(){
  $('#productModal').close();
  $('#productForm').reset();
  $('#editingProductId').value='';
  $('#productUploadStatus').textContent='';
  clearImagePreview();
}

function clearImagePreview(){
  const wrap=$('#productImagePreviewWrap');
  const preview=$('#productImagePreview');
  if(preview?.dataset.objectUrl==='true' && preview.src)URL.revokeObjectURL(preview.src);
  if(preview){
    preview.removeAttribute('src');
    preview.dataset.objectUrl='false';
  }
  if(wrap)wrap.hidden=true;
}

function showRemoteImagePreview(url){
  clearImagePreview();
  if(!url)return;
  const preview=$('#productImagePreview');
  preview.src=url;
  preview.dataset.objectUrl='false';
  $('#productImagePreviewWrap').hidden=false;
}

function previewSelectedImage(){
  clearImagePreview();
  const file=this.files?.[0];
  if(!file)return;
  if(!ALLOWED_IMAGE_TYPES.has(file.type)){
    this.value='';
    return toast('Please select a JPG, PNG, WebP, or GIF image.');
  }
  if(file.size>MAX_IMAGE_BYTES){
    this.value='';
    return toast('The image is larger than 5 MB.');
  }
  const preview=$('#productImagePreview');
  preview.src=URL.createObjectURL(file);
  preview.dataset.objectUrl='true';
  $('#productImagePreviewWrap').hidden=false;
}

function updateProductTitleCount(){
  const input=$('#productForm')?.elements?.title;
  const counter=$('#productTitleCount');
  if(counter)counter.textContent=String(input?.value?.length||0);
}

window.addEventListener('DOMContentLoaded',()=>{
  cats.forEach(c=>$('#productCategory').insertAdjacentHTML('beforeend',`<option value="${esc(c)}">${esc(c)}</option>`));
  $('#openSubmit').onclick=openCreateProduct;
  $('#closeProductModal').onclick=closeProductModal;
  $('#cancelProductEdit').onclick=closeProductModal;
  $('#profileForm').onsubmit=saveProfile;
  $('#productForm').onsubmit=saveProduct;
  $('#productImageFile').onchange=previewSelectedImage;
  $('#productForm').elements.title.addEventListener('input',updateProductTitleCount);
  updateProductTitleCount();
  $('#productModal').addEventListener('close',()=>{
    $('#productForm').reset();
    $('#editingProductId').value='';
    $('#productUploadStatus').textContent='';
    clearImagePreview();
  });

  $('#myProducts').addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit-product]');
    if(edit)return openEditProduct(edit.dataset.editProduct);
    const del=e.target.closest('[data-delete-product]');
    if(del)return deleteProduct(del.dataset.deleteProduct);
  });

  setTimeout(loadDashboard,300);
});
