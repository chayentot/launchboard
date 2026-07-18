const PAGE_SIZE=12;
let allProducts=[];
let visibleCount=PAGE_SIZE;
let likeCounts={};
let creatorsById={};

const categories=['Fashion & Clothing','Shoes','Bags & Accessories','Beauty & Cosmetics','Jewelry','Electronics','Software & Apps','Games','Books & eBooks','Courses & Education','Art & Design','Home & Living','Furniture','Food & Drinks','Pet Products','Automotive','Health & Fitness','Toys & Kids','Gifts','Handmade & Crafts','Tools & Hardware','Travel & Services','Other'];

function productCard(product){
  const creator=creatorsById[product.owner_id]||{};
  const image=product.image_url
    ? `<img src="${esc(safeUrl(product.image_url,''))}" alt="${esc(product.title)}" loading="lazy">`
    : `<div class="image-placeholder">No image</div>`;

  return `
    <article class="card product">
      <div class="product-card-heading">
        <div class="row between product-meta">
          <span>${esc(product.category||'Other')}</span>
          ${product.is_premium?'<span class="premium-pill">Premium</span>':''}
        </div>
        <h3><a href="product.html?id=${encodeURIComponent(product.id)}">${esc(product.title)}</a></h3>
        <strong class="product-price">${esc(formatPeso(product.price))}</strong>
      </div>
      <a class="product-media" href="product.html?id=${encodeURIComponent(product.id)}">${image}</a>
      <div class="product-body">
        <p class="muted">by <a href="creator.html?id=${encodeURIComponent(product.owner_id)}">${esc(creator.full_name||product.creator||'Creator')}</a> ${badge(creator)}</p>
        <div class="product-signals">
          <span>♡ ${likeCounts[product.id]||0}</span>
          <span>↗ ${product.clicks||0}</span>
          <span>◉ ${product.views||0}</span>
        </div>
      </div>
    </article>`;
}

function creatorCard(profile,stats={}){
  const avatar=profile.avatar_url
    ? `<img src="${esc(safeUrl(profile.avatar_url,''))}" alt="${esc(profile.full_name||'Creator')}" loading="lazy">`
    : `<div class="avatar-fallback">${esc((profile.full_name||profile.username||'?').slice(0,1).toUpperCase())}</div>`;
  return `
    <a class="card creator-card" href="creator.html?id=${encodeURIComponent(profile.id)}">
      <div class="creator-avatar">${avatar}</div>
      <div>
        <h3>${esc(profile.full_name||profile.username||'Creator')} ${badge(profile)}</h3>
        <p class="muted">${esc(profile.bio||profile.location||'Independent creator')}</p>
        <div class="creator-signals"><span>${stats.products||0} products</span><span>${stats.followers||0} followers</span></div>
      </div>
    </a>`;
}

async function fetchDiscoveryData(){
  if(!sb){
    $('#productGrid').innerHTML='<div class="card empty-state"><h3>Supabase is not configured.</h3></div>';
    return;
  }

  const [productsResult,profilesResult,likesResult,reviewsResult,followsResult]=await Promise.all([
    sb.from('products').select('*').eq('is_published',true).order('created_at',{ascending:false}),
    sb.from('profiles').select('*').eq('is_banned',false),
    sb.from('product_likes').select('product_id'),
    sb.from('product_reviews').select('product_id'),
    sb.from('creator_follows').select('creator_id')
  ]);

  if(productsResult.error)return toast(productsResult.error.message);
  if(profilesResult.error)return toast(profilesResult.error.message);

  allProducts=productsResult.data||[];
  creatorsById=Object.fromEntries((profilesResult.data||[]).map(profile=>[profile.id,profile]));

  likeCounts=(likesResult.data||[]).reduce((map,row)=>{
    map[row.product_id]=(map[row.product_id]||0)+1;
    return map;
  },{});

  renderHomeStats(profilesResult.data||[],reviewsResult.data||[]);
  renderCategoryControls();
  renderFeatured();
  renderProducts();
  renderCreators(profilesResult.data||[],followsResult.data||[]);
}

function renderHomeStats(profiles,reviews){
  const values=[
    allProducts.length,
    profiles.length,
    new Set(allProducts.map(p=>p.category).filter(Boolean)).size,
    reviews.length
  ];
  $$('#homeStats strong').forEach((el,index)=>el.textContent=values[index]||0);
}

function renderCategoryControls(){
  const select=$('#categoryFilter');
  categories.forEach(category=>select.insertAdjacentHTML('beforeend',`<option value="${esc(category)}">${esc(category)}</option>`));

  const popular=[...new Set(allProducts.map(p=>p.category).filter(Boolean))].slice(0,10);
  $('#categoryChips').innerHTML=[
    '<button class="chip active" type="button" data-category="">All</button>',
    ...popular.map(category=>`<button class="chip" type="button" data-category="${esc(category)}">${esc(category)}</button>`)
  ].join('');
}

function filteredProducts(){
  const query=$('#searchInput').value.trim().toLowerCase();
  const category=$('#categoryFilter').value;
  const type=$('#typeFilter').value;
  const sort=$('#sortFilter').value;

  let rows=allProducts.filter(product=>{
    const creator=creatorsById[product.owner_id]||{};
    const haystack=[
      product.title,product.description,product.brand,product.creator,
      product.category,product.country,product.product_type,
      ...(Array.isArray(product.tags)?product.tags:[]),
      creator.full_name,creator.username
    ].join(' ').toLowerCase();

    return (!query||haystack.includes(query))
      && (!category||product.category===category)
      && (!type||product.product_type===type);
  });

  rows.sort((a,b)=>{
    if(sort==='popular')return (b.views||0)-(a.views||0);
    if(sort==='clicked')return (b.clicks||0)-(a.clicks||0);
    if(sort==='liked')return (likeCounts[b.id]||0)-(likeCounts[a.id]||0);
    if(sort==='premium')return Number(b.is_premium)-Number(a.is_premium)||new Date(b.created_at)-new Date(a.created_at);
    return new Date(b.created_at)-new Date(a.created_at);
  });

  return rows;
}

function renderProducts(){
  const products=filteredProducts();
  const visible=products.slice(0,visibleCount);

  $('#productGrid').innerHTML=visible.map(productCard).join('');
  $('#emptyProducts').hidden=products.length>0;
  $('#loadMore').hidden=visible.length>=products.length;
  $('#resultSummary').textContent=`${products.length} product${products.length===1?'':'s'} found`;

  const selected=$('#categoryFilter').value;
  $$('#categoryChips .chip').forEach(chip=>chip.classList.toggle('active',chip.dataset.category===selected));
}

function renderFeatured(){
  const products=allProducts
    .filter(product=>product.is_premium||product.is_featured)
    .sort((a,b)=>Number(b.is_premium)-Number(a.is_premium)||(b.views||0)-(a.views||0))
    .slice(0,4);

  $('#featuredSection').hidden=products.length===0;
  $('#featuredProducts').innerHTML=products.map(productCard).join('');
}

function renderCreators(profiles,follows){
  const followerCounts=(follows||[]).reduce((map,row)=>{
    map[row.creator_id]=(map[row.creator_id]||0)+1;
    return map;
  },{});

  const productCounts=allProducts.reduce((map,row)=>{
    map[row.owner_id]=(map[row.owner_id]||0)+1;
    return map;
  },{});

  const ranked=profiles
    .filter(profile=>productCounts[profile.id])
    .sort((a,b)=>
      Number(b.is_verified)-Number(a.is_verified)
      ||(followerCounts[b.id]||0)-(followerCounts[a.id]||0)
      ||(productCounts[b.id]||0)-(productCounts[a.id]||0)
    )
    .slice(0,6);

  $('#topCreators').innerHTML=ranked.map(profile=>creatorCard(profile,{
    products:productCounts[profile.id]||0,
    followers:followerCounts[profile.id]||0
  })).join('')||'<div class="card empty-state"><p>No creators yet.</p></div>';
}

function clearFilters(){
  $('#searchInput').value='';
  $('#categoryFilter').value='';
  $('#typeFilter').value='';
  $('#sortFilter').value='newest';
  visibleCount=PAGE_SIZE;
  renderProducts();
}

window.addEventListener('DOMContentLoaded',()=>{
  $('#searchInput').addEventListener('input',()=>{visibleCount=PAGE_SIZE;renderProducts()});
  $('#categoryFilter').addEventListener('change',()=>{visibleCount=PAGE_SIZE;renderProducts()});
  $('#typeFilter').addEventListener('change',()=>{visibleCount=PAGE_SIZE;renderProducts()});
  $('#sortFilter').addEventListener('change',()=>{visibleCount=PAGE_SIZE;renderProducts()});
  $('#clearFilters').onclick=clearFilters;
  $('#emptyClear').onclick=clearFilters;
  $('#loadMore').onclick=()=>{visibleCount+=PAGE_SIZE;renderProducts()};

  $('#categoryChips').addEventListener('click',event=>{
    const chip=event.target.closest('[data-category]');
    if(!chip)return;
    $('#categoryFilter').value=chip.dataset.category;
    visibleCount=PAGE_SIZE;
    renderProducts();
  });

  $('#heroSearchForm').addEventListener('submit',event=>{
    event.preventDefault();
    $('#searchInput').value=$('#heroSearch').value;
    visibleCount=PAGE_SIZE;
    renderProducts();
    $('#discover').scrollIntoView({behavior:'smooth'});
  });

  $$('[data-sort-shortcut]').forEach(button=>{
    button.onclick=()=>{
      $('#sortFilter').value=button.dataset.sortShortcut;
      renderProducts();
      $('#discover').scrollIntoView({behavior:'smooth'});
    };
  });

  fetchDiscoveryData();
});
