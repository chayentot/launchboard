const PAGE_SIZE=12;
let allProducts=[];
let visibleCount=PAGE_SIZE;
let likeCounts={};
let creatorsById={};
let allProfiles=[];
let allFollowerRows=[];
let myFollowedCreatorIds=new Set();

const categories=['Fashion & Clothing','Shoes','Bags & Accessories','Beauty & Cosmetics','Jewelry','Electronics','Software & Apps','Games','Books & eBooks','Courses & Education','Art & Design','Home & Living','Furniture','Food & Drinks','Pet Products','Automotive','Health & Fitness','Toys & Kids','Gifts','Handmade & Crafts','Tools & Hardware','Travel & Services','Other'];

function productCard(product){
  const creator=creatorsById[product.owner_id]||{};
  const image=product.image_url
    ? `<img src="${esc(safeUrl(product.image_url,''))}" alt="${esc(product.title)}" loading="lazy">`
    : `<div class="image-placeholder">No image</div>`;

  return `
    <article class="card product v8-product-card">
      <a class="product-media" href="product.html?id=${encodeURIComponent(product.id)}">
        ${image}
        ${product.is_premium?'<span class="v8-premium-badge">Premium</span>':''}
      </a>
      <div class="v8-card-content">
        <div class="v8-card-signals">
          <span title="Likes">♡ ${likeCounts[product.id]||0}</span>
          <span title="Views">◉ ${product.views||0}</span>
        </div>
        <span class="v8-card-category">${esc(product.category||'Product')}</span>
        <h3><a href="product.html?id=${encodeURIComponent(product.id)}">${esc(product.title)}</a></h3>
        <div class="v84-card-bottom"><strong class="product-price">${esc(formatPeso(product.price))}</strong><span class="v84-view-product">View product →</span></div>
        <a class="v8-card-creator" href="creator.html?id=${encodeURIComponent(product.owner_id)}">
          ${esc(creator.full_name||product.creator||'Creator')} ${badge(creator)}
        </a>
      </div>
    </article>`;
}

function compactProductCard(product){
  const creator=creatorsById[product.owner_id]||{};
  return `<a class="v8-mini-product" href="product.html?id=${encodeURIComponent(product.id)}">
    <span class="v8-mini-image">
      ${product.image_url
        ? `<img src="${esc(safeUrl(product.image_url,''))}" alt="${esc(product.title)}" loading="lazy">`
        : '<span>No image</span>'}
    </span>
    <span class="v8-mini-copy">
      <strong>${esc(product.title)}</strong>
      <b>${esc(formatPeso(product.price))}</b>
      <small>${esc(creator.full_name||product.creator||'Creator')}</small>
    </span>
  </a>`;
}

function renderProductSkeletons(target,count=4){
  if(!target)return;
  target.innerHTML=Array.from({length:count},()=>`
    <div class="v8-product-skeleton" aria-hidden="true">
      <span></span><i></i><i></i><b></b>
    </div>`).join('');
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
  renderProductSkeletons($('#productGrid'),4);
  renderProductSkeletons($('#newTodayProducts'),4);
  renderProductSkeletons($('#trendingProducts'),4);
  renderProductSkeletons($('#recommendedProducts'),4);
  if(!sb){
    $('#productGrid').innerHTML='<div class="card empty-state"><h3>Supabase is not configured.</h3></div>';
    return;
  }

  const [productsResult,profilesResult,likesResult,reviewsResult,followsResult]=await Promise.all([
    sb.from('products').select('*').eq('is_published',true).order('created_at',{ascending:false}),
    sb.from('profiles').select('*').eq('is_banned',false),
    sb.from('product_likes').select('product_id'),
    sb.from('product_reviews').select('product_id'),
    sb.from('creator_follows').select('creator_id,follower_id')
  ]);

  if(productsResult.error)return toast(productsResult.error.message);
  if(profilesResult.error)return toast(profilesResult.error.message);

  allProducts=productsResult.data||[];
  allProfiles=profilesResult.data||[];
  allFollowerRows=followsResult.data||[];
  myFollowedCreatorIds=new Set(allFollowerRows.filter(row=>row.follower_id===currentUser?.id).map(row=>row.creator_id));
  creatorsById=Object.fromEntries(allProfiles.map(profile=>[profile.id,profile]));

  likeCounts=(likesResult.data||[]).reduce((map,row)=>{
    map[row.product_id]=(map[row.product_id]||0)+1;
    return map;
  },{});

  renderHomeStats(profilesResult.data||[],reviewsResult.data||[]);
  renderCategoryControls();
  renderFeatured();
  renderProducts();
  renderNewToday();
  renderTrending();
  renderRecommendations();
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
  if($('#categoryChips')) $('#categoryChips').innerHTML=[
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

  if(!$('#productGrid')) return;
  $('#productGrid').innerHTML=visible.map(productCard).join('');
  if($('#emptyProducts')) $('#emptyProducts').hidden=products.length>0;
  if($('#loadMore')) $('#loadMore').hidden=visible.length>=products.length;
  if($('#resultSummary')) $('#resultSummary').textContent=`${products.length} product${products.length===1?'':'s'} found`;

  const selected=$('#categoryFilter').value;
  $$('#categoryChips .chip').forEach(chip=>chip.classList.toggle('active',chip.dataset.category===selected));
}



function recommendationScore(product){
  const category=$('#categoryFilter')?.value||'';
  const creator=creatorsById[product.owner_id]||{};
  let score=0;
  if(category&&product.category===category)score+=8;
  score+=Math.min(Number(product.views||0)/25,8);
  score+=Math.min(Number(product.clicks||0)/10,6);
  score+=Math.min(Number(likeCounts[product.id]||0),7);
  if(product.is_featured)score+=3;
  if(creator.is_verified)score+=2;
  if(myFollowedCreatorIds.has(product.owner_id))score+=12;
  return score+Math.random()*2;
}

function renderRecommendations(){
  const target=$('#recommendedProducts');
  if(!target)return;

  const filtered=filteredProducts();
  const source=filtered.length?filtered:allProducts;
  const rows=[...source]
    .sort((a,b)=>recommendationScore(b)-recommendationScore(a))
    .slice(0,6);

  target.innerHTML=rows.map(productCard).join('')
    || '<div class="card empty-state compact-empty"><p>No products available yet.</p></div>';
}


function renderNewToday(){
  const target=$('#newTodayProducts');
  if(!target)return;

  const now=Date.now();
  const oneDay=24*60*60*1000;
  let rows=allProducts.filter(product=>{
    const created=new Date(product.created_at).getTime();
    return Number.isFinite(created)&&now-created<=oneDay;
  });

  if(!rows.length)rows=[...allProducts].slice(0,8);
  target.innerHTML=rows.slice(0,8).map(compactProductCard).join('')
    || '<div class="v8-compact-empty">No new products yet.</div>';
}

function trendingScore(product){
  return Number(product.views||0)
    + Number(product.clicks||0)*3
    + Number(likeCounts[product.id]||0)*5;
}

function renderTrending(){
  const target=$('#trendingProducts');
  if(!target)return;

  const rows=[...allProducts]
    .sort((a,b)=>trendingScore(b)-trendingScore(a))
    .slice(0,8);

  target.innerHTML=rows.map(compactProductCard).join('')
    || '<div class="v8-compact-empty">Trending products will appear here.</div>';
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



let mobileSearchTimer;

function initializeV63HomeControls(){
  const searchForm=$('#mobileCommerceSearchForm');
  const searchBox=$('#mobileCommerceSearch');
  const desktopSearch=$('#searchInput');

  function runSearch(){
    if(desktopSearch&&searchBox)desktopSearch.value=searchBox.value.trim();
    visibleCount=PAGE_SIZE;
    renderProducts();
    renderRecommendations();
    document.querySelector('#discover')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  searchForm?.addEventListener('submit',event=>{
    event.preventDefault();
    runSearch();
  });

  searchBox?.addEventListener('search',runSearch);
  searchBox?.addEventListener('input',()=>{
    clearTimeout(mobileSearchTimer);
    mobileSearchTimer=setTimeout(()=>{
      if(desktopSearch)desktopSearch.value=searchBox.value.trim();
      visibleCount=PAGE_SIZE;
      renderProducts();
      renderRecommendations();
    },220);
  });

  const sheet=$('#mobileFilterSheet');
  const category=$('#mobileCategoryFilter');
  const type=$('#mobileTypeFilter');
  const sort=$('#mobileSortFilter');

  function populateMobileCategories(){
    if(!category||category.options.length>1)return;
    categories.forEach(name=>{
      const option=document.createElement('option');
      option.value=name;
      option.textContent=name;
      category.appendChild(option);
    });
  }

  function syncMobileControls(){
    populateMobileCategories();
    if(category&&$('#categoryFilter'))category.value=$('#categoryFilter').value;
    if(type&&$('#typeFilter'))type.value=$('#typeFilter').value;
    if(sort&&$('#sortFilter'))sort.value=$('#sortFilter').value;
  }

  function openSheet(focusSort=false){
    syncMobileControls();
    if(sheet?.showModal)sheet.showModal();
    else sheet?.setAttribute('open','');
    if(focusSort)setTimeout(()=>sort?.focus(),100);
  }

  function activeFilterCount(){
    return [$('#categoryFilter')?.value,$('#typeFilter')?.value].filter(Boolean).length;
  }

  function updateFilterBadge(){
    const badge=$('#mobileFilterCount');
    if(badge)badge.textContent=String(activeFilterCount());
  }

  $('#inlineSearchFilter')?.addEventListener('click',()=>openSheet(false));
  

  $('#mobileResetFilters')?.addEventListener('click',()=>{
    if(category)category.value='';
    if(type)type.value='';
    if(sort)sort.value='newest';
  });

  $('#mobileApplyFilters')?.addEventListener('click',()=>{
    if($('#categoryFilter')&&category)$('#categoryFilter').value=category.value;
    if($('#typeFilter')&&type)$('#typeFilter').value=type.value;
    if($('#sortFilter')&&sort)$('#sortFilter').value=sort.value;
    visibleCount=PAGE_SIZE;
    renderProducts();
    renderRecommendations();
    updateFilterBadge();
    sheet?.close?.();
  });

  sort?.addEventListener('change',()=>{
    if($('#sortFilter'))$('#sortFilter').value=sort.value;
    visibleCount=PAGE_SIZE;
    renderProducts();
    renderRecommendations();
  });

  $('#refreshTrending')?.addEventListener('click',()=>{
    renderTrending();
    toast('Trending products refreshed.','success');
  });

  $('#refreshRecommendations')?.addEventListener('click',()=>{
    renderRecommendations();
    toast('Recommendations refreshed.','success');
  });

  function creatorDirectoryRows(){
    const followerCounts=allFollowerRows.reduce((map,row)=>{
      map[row.creator_id]=(map[row.creator_id]||0)+1;
      return map;
    },{});
    const productCounts=allProducts.reduce((map,row)=>{
      map[row.owner_id]=(map[row.owner_id]||0)+1;
      return map;
    },{});

    return allProfiles
      .filter(profile=>productCounts[profile.id])
      .sort((a,b)=>
        Number(b.is_verified)-Number(a.is_verified)
        ||(followerCounts[b.id]||0)-(followerCounts[a.id]||0)
        ||(productCounts[b.id]||0)-(productCounts[a.id]||0)
      )
      .map(profile=>creatorCard(profile,{
        products:productCounts[profile.id]||0,
        followers:followerCounts[profile.id]||0
      })).join('');
  }

  $('#seeCreatorsButton')?.addEventListener('click',()=>{
    const grid=$('#creatorDirectoryGrid');
    if(grid)grid.innerHTML=creatorDirectoryRows()
      || '<div class="card empty-state"><p>No creators available yet.</p></div>';
    $('#creatorDirectoryModal')?.showModal?.();
  });

  $('#closeCreatorDirectory')?.addEventListener('click',()=>$('#creatorDirectoryModal')?.close?.());

  updateFilterBadge();
}

window.addEventListener('DOMContentLoaded',()=>{
  initializeV63HomeControls();
  $('#searchInput')?.addEventListener('input',()=>{visibleCount=PAGE_SIZE;renderProducts()});
  $('#categoryFilter')?.addEventListener('change',()=>{visibleCount=PAGE_SIZE;renderProducts()});
  $('#typeFilter')?.addEventListener('change',()=>{visibleCount=PAGE_SIZE;renderProducts()});
  $('#sortFilter')?.addEventListener('change',()=>{visibleCount=PAGE_SIZE;renderProducts()});
  if($('#clearFilters')) $('#clearFilters').onclick=clearFilters;
  if($('#emptyClear')) $('#emptyClear').onclick=clearFilters;
  if($('#loadMore')) $('#loadMore').onclick=()=>{visibleCount+=PAGE_SIZE;renderProducts()};

  $('#categoryChips')?.addEventListener('click',event=>{
    const chip=event.target.closest('[data-category]');
    if(!chip)return;
    $('#categoryFilter').value=chip.dataset.category;
    visibleCount=PAGE_SIZE;
    renderProducts();
  });

  $('#heroSearchForm')?.addEventListener('submit',event=>{
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
