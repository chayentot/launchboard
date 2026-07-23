
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
  const grid=document.getElementById('followingGrid');
  const status=document.getElementById('libraryStatus');
  const count=document.getElementById('libraryCount');
  const search=document.getElementById('librarySearch');

  function avatar(profile){
    return profile.avatar_url
      ? `<img src="${lbLibraryEscape(lbLibrarySafeUrl(profile.avatar_url,''))}" alt="${lbLibraryEscape(profile.full_name||profile.username||'Creator')}" loading="lazy">`
      : `<span>${lbLibraryEscape(lbInitials(profile))}</span>`;
  }

  function creatorCard(row){
    const profile=row.profile||{};
    const productCount=row.productCount||0;
    return `<article class="card library-creator-card" data-creator-id="${lbLibraryEscape(profile.id||'')}">
      <a class="library-avatar" href="creator.html?id=${encodeURIComponent(profile.id||'')}">${avatar(profile)}</a>
      <div class="library-creator-copy">
        <h2>
          <a href="creator.html?id=${encodeURIComponent(profile.id||'')}">${lbLibraryEscape(profile.full_name||profile.username||'Creator')}</a>
          ${lbVerified(profile)}
        </h2>
        <p>${lbLibraryEscape(profile.bio||profile.location||'Independent creator')}</p>
        <div class="library-creator-meta">
          <span>${productCount} product${productCount===1?'':'s'}</span>
          ${profile.location?`<span>${lbLibraryEscape(profile.location)}</span>`:''}
        </div>
      </div>
      <div class="library-creator-actions">
        <a class="btn btn-primary" href="creator.html?id=${encodeURIComponent(profile.id||'')}">View profile</a>
        <a class="btn btn-ghost" href="messages.html?user=${encodeURIComponent(profile.id||'')}">Message</a>
        <button class="btn btn-danger-soft" type="button" data-unfollow="${lbLibraryEscape(profile.id||'')}">Unfollow</button>
      </div>
    </article>`;
  }

  function render(){
    const q=state.query.trim().toLowerCase();
    const visible=state.rows.filter(({profile})=>{
      if(!q)return true;
      return [profile?.full_name,profile?.username,profile?.bio,profile?.location]
        .some(value=>String(value||'').toLowerCase().includes(q));
    });

    count.textContent=`${visible.length} following`;
    status.hidden=true;

    if(!state.rows.length){
      grid.innerHTML=lbEmptyState('☆','You are not following anyone yet','Discover creators and follow the ones you like.','index.html#creators','Find creators');
      return;
    }
    if(!visible.length){
      grid.innerHTML=lbEmptyState('⌕','No matching creators','Try another search.','following.html','Clear search');
      grid.querySelector('a')?.addEventListener('click',event=>{
        event.preventDefault();
        search.value='';
        state.query='';
        render();
      });
      return;
    }

    grid.innerHTML=visible.map(creatorCard).join('');
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
    status.textContent='Loading followed creators…';

    const {data:follows,error:followsError}=await sb
      .from('creator_follows')
      .select('creator_id,created_at')
      .eq('follower_id',currentUser.id)
      .order('created_at',{ascending:false});

    if(followsError){
      status.textContent=followsError.message;
      return;
    }

    const creatorIds=[...new Set((follows||[]).map(row=>row.creator_id).filter(Boolean))];
    if(!creatorIds.length){
      state.rows=[];
      render();
      return;
    }

    const [{data:profiles,error:profileError},{data:products,error:productError}]=await Promise.all([
      sb.from('profiles').select('*').in('id',creatorIds).eq('is_banned',false),
      sb.from('products').select('owner_id').in('owner_id',creatorIds).eq('is_published',true)
    ]);

    if(profileError||productError){
      status.textContent=(profileError||productError).message;
      return;
    }

    const profileMap=Object.fromEntries((profiles||[]).map(row=>[row.id,row]));
    const productCounts=(products||[]).reduce((map,row)=>{
      map[row.owner_id]=(map[row.owner_id]||0)+1;
      return map;
    },{});

    state.rows=(follows||[])
      .map(follow=>profileMap[follow.creator_id]
        ? {follow,profile:profileMap[follow.creator_id],productCount:productCounts[follow.creator_id]||0}
        : null)
      .filter(Boolean);

    render();
  }

  search?.addEventListener('input',()=>{
    state.query=search.value;
    render();
  });

  grid?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-unfollow]');
    if(!button)return;

    const creatorId=button.dataset.unfollow;
    const creator=state.rows.find(row=>String(row.profile.id)===String(creatorId))?.profile;
    const confirmed=window.confirm(`Unfollow ${creator?.full_name||creator?.username||'this creator'}?`);
    if(!confirmed)return;

    button.disabled=true;
    button.textContent='Unfollowing…';

    const {error}=await sb
      .from('creator_follows')
      .delete()
      .eq('follower_id',currentUser.id)
      .eq('creator_id',creatorId);

    if(error){
      button.disabled=false;
      button.textContent='Unfollow';
      lbLibraryToast(error.message);
      return;
    }

    state.rows=state.rows.filter(row=>String(row.profile.id)!==String(creatorId));
    lbLibraryToast('Creator unfollowed.','success');
    render();
  });

  load().catch(error=>{
    console.error(error);
    status.textContent=error.message||'Could not load followed creators.';
  });
})();
