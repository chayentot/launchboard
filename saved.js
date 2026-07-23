
function lbWaitForAuth(){
  return new Promise(resolve=>{
    if(typeof authReady!=='undefined' && authReady){
      resolve();
      return;
    }
    document.addEventListener('launchboard:auth-ready',()=>resolve(),{once:true});
  });
}

function lbLibraryEscape(value=''){
  if(typeof esc==='function')return esc(value);
  return String(value).replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);
}

function lbLibrarySafeUrl(value,fallback='#'){
  if(typeof safeUrl==='function')return safeUrl(value,fallback);
  try{
    const url=new URL(String(value||''),location.href);
    return ['http:','https:'].includes(url.protocol)?url.href:fallback;
  }catch{
    return fallback;
  }
}

function lbLibraryToast(message,type='error'){
  if(typeof toast==='function')toast(message,type);
  else alert(message);
}

function lbInitials(profile){
  const text=profile?.full_name||profile?.username||'?';
  return String(text).trim().slice(0,1).toUpperCase()||'?';
}

function lbVerified(profile){
  return profile?.is_verified
    ? '<span class="verified" title="Verified creator" aria-label="Verified creator">✓</span>'
    : '';
}

function lbEmptyState(icon,title,copy,linkHref='index.html',linkLabel='Explore marketplace'){
  return `<article class="library-empty card">
    <span class="library-empty-icon" aria-hidden="true">${icon}</span>
    <h2>${lbLibraryEscape(title)}</h2>
    <p>${lbLibraryEscape(copy)}</p>
    <a class="btn btn-primary" href="${lbLibraryEscape(linkHref)}">${lbLibraryEscape(linkLabel)}</a>
  </article>`;
}

(() => {
  'use strict';

  const state={rows:[],query:''};
  const grid=document.getElementById('savedProductsGrid');
  const status=document.getElementById('libraryStatus');
  const count=document.getElementById('libraryCount');
  const search=document.getElementById('librarySearch');

  function productCard(row){
    const product=row.product||{};
    const creator=row.creator||{};
    const image=product.image_url
      ? `<img src="${lbLibraryEscape(lbLibrarySafeUrl(product.image_url,''))}" alt="${lbLibraryEscape(product.title||'Product')}" loading="lazy">`
      : '<span class="library-image-placeholder">No image</span>';

    return `<article class="card library-product-card" data-product-id="${lbLibraryEscape(product.id||'')}">
      <a class="library-product-image" href="product.html?id=${encodeURIComponent(product.id||'')}">${image}</a>
      <div class="library-product-copy">
        <span class="library-kicker">${lbLibraryEscape(product.category||product.product_type||'Product')}</span>
        <h2><a href="product.html?id=${encodeURIComponent(product.id||'')}">${lbLibraryEscape(product.title||'Untitled product')}</a></h2>
        <strong class="library-price">${lbLibraryEscape(typeof formatPeso==='function'?formatPeso(product.price):product.price||'Contact for price')}</strong>
        <a class="library-creator-link" href="creator.html?id=${encodeURIComponent(product.owner_id||'')}">
          ${lbLibraryEscape(creator.full_name||creator.username||product.creator||'Creator')} ${lbVerified(creator)}
        </a>
        <div class="library-card-actions">
          <a class="btn btn-primary" href="product.html?id=${encodeURIComponent(product.id||'')}">Open product</a>
          <button class="btn btn-ghost" type="button" data-remove-saved="${lbLibraryEscape(product.id||'')}">Remove</button>
        </div>
      </div>
    </article>`;
  }

  function render(){
    const q=state.query.trim().toLowerCase();
    const visible=state.rows.filter(({product,creator})=>{
      if(!q)return true;
      return [
        product?.title,product?.category,product?.brand,product?.creator,
        creator?.full_name,creator?.username
      ].some(value=>String(value||'').toLowerCase().includes(q));
    });

    count.textContent=`${visible.length} saved`;
    status.hidden=true;

    if(!state.rows.length){
      grid.innerHTML=lbEmptyState('♡','No saved products yet','Tap the heart on a product to save it here.');
      return;
    }
    if(!visible.length){
      grid.innerHTML=lbEmptyState('⌕','No matching products','Try another search.','saved.html','Clear search');
      grid.querySelector('a')?.addEventListener('click',event=>{
        event.preventDefault();
        search.value='';
        state.query='';
        render();
      });
      return;
    }
    grid.innerHTML=visible.map(productCard).join('');
  }

  async function load(){
    await lbWaitForAuth();

    if(typeof sb==='undefined'||!sb){
      status.textContent='Supabase is not configured.';
      return;
    }
    if(typeof currentUser==='undefined'||!currentUser){
      location.replace('index.html?login=1');
      return;
    }

    status.hidden=false;
    status.textContent='Loading saved products…';

    const {data:likes,error:likesError}=await sb
      .from('product_likes')
      .select('product_id,created_at')
      .eq('user_id',currentUser.id)
      .order('created_at',{ascending:false});

    if(likesError){
      status.textContent=likesError.message;
      return;
    }

    const productIds=[...new Set((likes||[]).map(row=>row.product_id).filter(Boolean))];
    if(!productIds.length){
      state.rows=[];
      render();
      return;
    }

    const {data:products,error:productsError}=await sb
      .from('products')
      .select('*')
      .in('id',productIds)
      .eq('is_published',true);

    if(productsError){
      status.textContent=productsError.message;
      return;
    }

    const creatorIds=[...new Set((products||[]).map(row=>row.owner_id).filter(Boolean))];
    let profiles=[];
    if(creatorIds.length){
      const result=await sb.from('profiles').select('*').in('id',creatorIds);
      if(result.error){
        status.textContent=result.error.message;
        return;
      }
      profiles=result.data||[];
    }

    const productMap=Object.fromEntries((products||[]).map(row=>[row.id,row]));
    const profileMap=Object.fromEntries(profiles.map(row=>[row.id,row]));

    state.rows=(likes||[])
      .map(like=>productMap[like.product_id]
        ? {like,product:productMap[like.product_id],creator:profileMap[productMap[like.product_id].owner_id]||{}}
        : null)
      .filter(Boolean);

    render();
  }

  search?.addEventListener('input',()=>{
    state.query=search.value;
    render();
  });

  grid?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-remove-saved]');
    if(!button)return;

    const productId=button.dataset.removeSaved;
    button.disabled=true;
    button.textContent='Removing…';

    const {error}=await sb
      .from('product_likes')
      .delete()
      .eq('user_id',currentUser.id)
      .eq('product_id',productId);

    if(error){
      button.disabled=false;
      button.textContent='Remove';
      lbLibraryToast(error.message);
      return;
    }

    state.rows=state.rows.filter(row=>String(row.product.id)!==String(productId));
    lbLibraryToast('Removed from saved products.','success');
    render();
  });

  load().catch(error=>{
    console.error(error);
    status.textContent=error.message||'Could not load saved products.';
  });
})();
