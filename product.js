const id=new URLSearchParams(location.search).get('id');let product,owner,liked=false;
async function loadProduct(){if(!id){$('#productPage').textContent='Missing product ID.';return}if(!sb){$('#productPage').textContent='Supabase is not configured.';return}const [p,l,r]=await Promise.all([sb.from('products').select('*').eq('id',id).single(),sb.from('product_likes').select('*').eq('product_id',id),sb.from('product_reviews').select('*,profiles(full_name,avatar_url,is_verified)').eq('product_id',id).order('created_at',{ascending:false})]);if(p.error)return $('#productPage').textContent='Product not found.';product=p.data;owner=(await sb.from('profiles').select('*').eq('id',product.owner_id).maybeSingle()).data||{id:product.owner_id,full_name:product.creator};liked=!!currentUser&&(l.data||[]).some(x=>x.user_id===currentUser.id);await sb.rpc('increment_product_views',{product_id:id});renderProduct(l.data||[],r.data||[])}
function renderProduct(likes,reviews){
  const avg=reviews.length
    ? (reviews.reduce((sum,item)=>sum+item.rating,0)/reviews.length).toFixed(1)
    : 'No ratings';

  $('#productPage').innerHTML=`
    <div class="product-page-header card pad v8-product-header">
      <span class="eyebrow">${esc(product.category||'Product')}</span>
      <h1>${esc(product.title)}</h1>
      <div class="product-page-price">${esc(formatPeso(product.price))}</div>
      <p class="muted">${esc(product.brand||product.product_type||'Product')}</p>
    </div>

    <div class="two-col product-detail-grid">
      <section>
        <div class="card detail-media">
          ${product.image_url
            ? `<img src="${esc(safeUrl(product.image_url,''))}" alt="${esc(product.title)}">`
            : '<div class="image-placeholder">No image available</div>'}
        </div>

        <div class="product-image-actions">
          <button class="product-heart-action ${liked?'is-liked':''}" id="likeBtn" type="button">
            <span>${liked?'♥':'♡'}</span>
            <span>${liked?'Liked':'Like'}</span>
            <strong>${likes.length}</strong>
          </button>
          <button class="v8-share-action" id="shareProduct" type="button">Share</button>
          <a class="product-visit-action" id="visitBtn" href="${safeUrl(product.product_url)}" target="_blank" rel="noopener">
            Visit product ↗
          </a>
        </div>

        <article class="card pad v8-creator-mini">
          <a class="v8-creator-mini-profile" href="creator.html?id=${encodeURIComponent(owner.id)}">
            <span class="v8-creator-mini-avatar">
              ${owner.avatar_url
                ? `<img src="${esc(safeUrl(owner.avatar_url,''))}" alt="${esc(owner.full_name||'Creator')}">`
                : esc((owner.full_name||product.creator||'?').slice(0,1).toUpperCase())}
            </span>
            <span>
              <strong>${esc(owner.full_name||product.creator||'Creator')} ${badge(owner)}</strong>
              <small>${esc(owner.bio||'Independent creator')}</small>
            </span>
          </a>
          <button class="btn btn-soft" id="messageBtn" type="button">Message</button>
        </article>

        <div class="card pad v8-about-product">
          <h2>About this product</h2>
          <p>${esc(product.description||'No description provided.')}</p>
          <div class="chips">${(product.tags||[]).map(tag=>`<span class="chip">#${esc(tag)}</span>`).join('')}</div>
        </div>

        <div class="card pad v8-reviews">
          <div class="section-head">
            <h2>Reviews</h2>
            <strong>${avg} · ${reviews.length}</strong>
          </div>
          ${currentUser&&currentUser.id!==product.owner_id?`
            <form id="reviewForm" class="form-grid">
              <select class="field" name="rating">
                <option value="5">5 stars</option>
                <option value="4">4 stars</option>
                <option value="3">3 stars</option>
                <option value="2">2 stars</option>
                <option value="1">1 star</option>
              </select>
              <input class="field" name="body" minlength="3" maxlength="600" placeholder="Share your experience" required>
              <button class="btn btn-primary full">Post review</button>
            </form>`:''}
          <div>${reviews.map(item=>`
            <article class="review">
              <strong>${esc(item.profiles?.full_name||'Member')} ${badge(item.profiles)}</strong>
              <div class="stars">${'★'.repeat(item.rating)}${'☆'.repeat(5-item.rating)}</div>
              <p>${esc(item.body)}</p>
            </article>`).join('')||'<p class="muted">No reviews yet.</p>'}</div>
        </div>

        <section class="product-related-section">
          <div class="section-heading">
            <div><span class="eyebrow">More to explore</span><h2>Related products</h2></div>
          </div>
          <div class="product-grid" id="relatedProducts"></div>
        </section>
      </section>
    </div>

    <div class="v8-sticky-product-actions">
      <button id="stickyMessageButton" type="button">Message</button>
      <a id="stickyVisitButton" href="${safeUrl(product.product_url)}" target="_blank" rel="noopener">Visit product</a>
    </div>`;

  $('#likeBtn').onclick=toggleLike;
  $('#visitBtn').onclick=()=>sb.rpc('increment_product_clicks',{product_id:id});
  $('#messageBtn').onclick=startChat;
  $('#stickyMessageButton').onclick=startChat;
  $('#stickyVisitButton').onclick=()=>sb.rpc('increment_product_clicks',{product_id:id});
  $('#shareProduct').onclick=shareProduct;
  $('#reviewForm')?.addEventListener('submit',review);
  renderRelatedProducts();
}

async function shareProduct(){
  const shareData={
    title:product.title,
    text:`${product.title} on LaunchBoard`,
    url:location.href
  };

  try{
    if(navigator.share){
      await navigator.share(shareData);
    }else{
      toast('Open this page in your browser to copy or share the link.','success');
    }
  }catch(error){
    if(error?.name!=='AbortError')toast('Unable to share this product.');
  }
}

async function toggleLike(){if(!currentUser)return $('#loginModal').showModal();if(liked)await sb.from('product_likes').delete().eq('user_id',currentUser.id).eq('product_id',id);else await sb.from('product_likes').insert({user_id:currentUser.id,product_id:id});liked=!liked;loadProduct()}
async function review(e){e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from('product_reviews').upsert({product_id:id,author_id:currentUser.id,rating:+f.get('rating'),body:f.get('body')},{onConflict:'product_id,author_id'});if(error)return toast(error.message);loadProduct()}
async function startChat(){
  if(!currentUser)return $('#loginModal').showModal();
  if(!owner?.id)return toast('Creator information is unavailable.');
  if(currentUser.id===owner.id)return toast('This is your own product.');

  const buttons=[$('#messageBtn'),$('#stickyMessageButton')].filter(Boolean);
  buttons.forEach(button=>button.disabled=true);

  try{
    const {data,error}=await sb.rpc('start_conversation',{
      target_user:owner.id,
      target_product:id
    });
    if(error)throw error;

    const conversationId=typeof data==='string'
      ? data
      : Array.isArray(data)
        ? (data[0]?.start_conversation||data[0]?.conversation_id||data[0]?.id||data[0])
        : (data?.start_conversation||data?.conversation_id||data?.id||data);

    if(!conversationId)throw new Error('The conversation could not be opened.');

    const params=new URLSearchParams({
      conversation:String(conversationId),
      creator:String(owner.id),
      product:String(id),
      source:'product'
    });
    location.href=`messages.html?${params.toString()}`;
  }catch(error){
    toast(error?.message||'Unable to message this creator.');
    buttons.forEach(button=>button.disabled=false);
  }
}
window.addEventListener('DOMContentLoaded',()=>{document.addEventListener('launchboard:auth-ready',loadProduct,{once:true});if(authReady)loadProduct()});

window.addEventListener('DOMContentLoaded',()=>{
  const button=$('#reportProduct');
  if(button){
    button.hidden=false;
    button.onclick=()=>openReportDialog('product',id);
  }
});


async function renderRelatedProducts(){
  const target=$('#relatedProducts');
  if(!target||!product)return;

  const {data,error}=await sb.from('products')
    .select('*')
    .eq('category',product.category)
    .neq('id',product.id)
    .order('created_at',{ascending:false})
    .limit(4);

  if(error){
    console.warn('Related products failed:',error);
    target.closest('.product-related-section')?.remove();
    return;
  }

  const rows=data||[];
  if(!rows.length){
    target.closest('.product-related-section')?.remove();
    return;
  }

  target.innerHTML=rows.map(item=>`
    <a class="related-product-card" href="product.html?id=${item.id}">
      <span class="related-product-image">
        ${item.image_url
          ? `<img src="${esc(safeUrl(item.image_url,''))}" alt="${esc(item.title)}">`
          : '<span>No image</span>'}
      </span>
      <span class="related-product-copy">
        <strong>${esc(item.title)}</strong>
        <small>${esc(formatPeso(item.price))}</small>
      </span>
    </a>`).join('');
}
