const id=new URLSearchParams(location.search).get('id');let product,owner,liked=false;
async function loadProduct(){if(!id){$('#productPage').textContent='Missing product ID.';return}if(!sb){$('#productPage').textContent='Supabase is not configured.';return}const [p,l,r]=await Promise.all([sb.from('products').select('*').eq('id',id).single(),sb.from('product_likes').select('*').eq('product_id',id),sb.from('product_reviews').select('*,profiles(full_name,avatar_url,is_verified)').eq('product_id',id).order('created_at',{ascending:false})]);if(p.error)return $('#productPage').textContent='Product not found.';product=p.data;owner=(await sb.from('profiles').select('*').eq('id',product.owner_id).maybeSingle()).data||{id:product.owner_id,full_name:product.creator};liked=!!currentUser&&(l.data||[]).some(x=>x.user_id===currentUser.id);await sb.rpc('increment_product_views',{product_id:id});renderProduct(l.data||[],r.data||[])}
function renderProduct(likes,reviews){
  const avg=reviews.length?(reviews.reduce((s,x)=>s+x.rating,0)/reviews.length).toFixed(1):'No ratings';
  $('#productPage').innerHTML=`
    <div class="product-page-header card pad">
      <span class="eyebrow">${esc(product.category||'Product')}</span>
      <h1>${esc(product.title)}</h1>
      <div class="product-page-price">${esc(formatPeso(product.price))}</div>
      <p class="muted">${esc(product.brand||product.product_type||'Product')}</p>
    </div>

    <div class="two-col product-detail-grid">
      <section>
        <div class="card detail-media">
          ${product.image_url?`<img src="${esc(safeUrl(product.image_url,''))}" alt="${esc(product.title)}">`:'<div class="image-placeholder">No image available</div>'}
        </div>

        <div class="card pad" style="margin-top:20px">
          <h2>About this product</h2>
          <p>${esc(product.description)}</p>
          <div class="chips">${(product.tags||[]).map(t=>`<span class="chip">#${esc(t)}</span>`).join('')}</div>
        </div>

        <div class="card pad" style="margin-top:20px">
          <div class="section-head"><h2>Reviews</h2><strong>${avg} · ${reviews.length} reviews</strong></div>
          ${currentUser&&currentUser.id!==product.owner_id?`
            <form id="reviewForm" class="form-grid">
              <select class="field" name="rating">
                <option value="5">5 stars</option><option value="4">4 stars</option>
                <option value="3">3 stars</option><option value="2">2 stars</option>
                <option value="1">1 star</option>
              </select>
              <input class="field" name="body" minlength="3" maxlength="600" placeholder="Share your experience" required>
              <button class="btn btn-primary full">Post review</button>
            </form>`:''}
          <div>${reviews.map(x=>`
            <article class="review">
              <strong>${esc(x.profiles?.full_name||'Member')} ${badge(x.profiles)}</strong>
              <div class="stars">${'★'.repeat(x.rating)}${'☆'.repeat(5-x.rating)}</div>
              <p>${esc(x.body)}</p>
            </article>`).join('')||'<p class="muted">No reviews yet.</p>'}
          </div>
        </div>
      </section>

      <aside>
        <div class="card pad product-actions-card">
          <div class="row product-action-buttons">
            <button class="btn ${liked?'btn-soft':'btn-ghost'}" id="likeBtn">♡ ${likes.length}</button>
            <a class="btn btn-primary" id="visitBtn" href="${safeUrl(product.product_url)}" target="_blank" rel="noopener">Visit product ↗</a>
          </div>
        </div>

        <div class="card pad" style="margin-top:20px">
          <div class="profile-head">
            <img class="avatar" src="${esc(safeUrl(owner.avatar_url,'https://placehold.co/160x160?text=Creator'))}" alt="${esc(owner.full_name||product.creator||'Creator')}">
            <div>
              <h3>${esc(owner.full_name||product.creator)} ${badge(owner)}</h3>
              <a href="creator.html?id=${owner.id}">View creator profile</a>
            </div>
          </div>
          <button class="btn btn-soft" id="messageBtn" style="width:100%;margin-top:15px">Message creator</button>
        </div>
      </aside>
    </div>`;

  $('#likeBtn').onclick=toggleLike;
  $('#visitBtn').onclick=()=>sb.rpc('increment_product_clicks',{product_id:id});
  $('#messageBtn').onclick=startChat;
  $('#reviewForm')?.addEventListener('submit',review);
}

async function toggleLike(){if(!currentUser)return $('#loginModal').showModal();if(liked)await sb.from('product_likes').delete().eq('user_id',currentUser.id).eq('product_id',id);else await sb.from('product_likes').insert({user_id:currentUser.id,product_id:id});liked=!liked;loadProduct()}
async function review(e){e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from('product_reviews').upsert({product_id:id,author_id:currentUser.id,rating:+f.get('rating'),body:f.get('body')},{onConflict:'product_id,author_id'});if(error)return toast(error.message);loadProduct()}
async function startChat(){if(!currentUser)return $('#loginModal').showModal();const {data,error}=await sb.rpc('start_conversation',{target_user:owner.id,target_product:id});if(error)return toast(error.message);location.href=`messages.html?conversation=${data}`}
window.addEventListener('DOMContentLoaded',()=>{document.addEventListener('launchboard:auth-ready',loadProduct,{once:true});if(authReady)loadProduct()});

window.addEventListener('DOMContentLoaded',()=>{
  const button=$('#reportProduct');
  if(button){
    button.hidden=false;
    button.onclick=()=>openReportDialog('product',id);
  }
});
