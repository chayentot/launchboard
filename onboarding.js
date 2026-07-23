const REQUIRED_CREATOR_FOLLOWS=5;
let onboardingProfiles=[];
let onboardingFollowing=new Set();

function onboardingAvatar(profile){
  if(profile.avatar_url){
    return `<img src="${esc(safeUrl(profile.avatar_url,''))}" alt="${esc(profile.full_name||profile.username||'Creator')}" loading="lazy">`;
  }
  return `<span>${esc((profile.full_name||profile.username||'?').slice(0,1).toUpperCase())}</span>`;
}

function updateOnboardingProgress(){
  const count=onboardingFollowing.size;
  const capped=Math.min(count,REQUIRED_CREATOR_FOLLOWS);
  $('#selectedCount').textContent=count;
  $('#onboardingProgressBar').style.width=`${(capped/REQUIRED_CREATOR_FOLLOWS)*100}%`;
  const complete=count>=REQUIRED_CREATOR_FOLLOWS;
  $('#completeOnboarding').disabled=!complete;
  $('#onboardingStatus').textContent=complete
    ? 'You are ready to continue.'
    : `Choose ${REQUIRED_CREATOR_FOLLOWS-count} more creator${REQUIRED_CREATOR_FOLLOWS-count===1?'':'s'} to continue.`;
}

function renderOnboardingCreators(){
  const target=$('#onboardingCreators');
  const query=String($('#creatorOnboardingSearch')?.value||'').trim().toLowerCase();
  const visible=onboardingProfiles.filter(profile=>{
    const text=[profile.full_name,profile.username,profile.bio,profile.location].filter(Boolean).join(' ').toLowerCase();
    return !query||text.includes(query);
  });
  target.innerHTML=visible.map(profile=>{
    const followed=onboardingFollowing.has(profile.id);
    return `<article class="card onboarding-creator-card ${followed?'is-following':''}">
      <div class="onboarding-creator-avatar">${onboardingAvatar(profile)}</div>
      <div class="onboarding-creator-copy">
        <h2>${esc(profile.full_name||profile.username||'Creator')} ${badge(profile)}</h2>
        <p>${esc(profile.bio||profile.location||'Independent creator')}</p>
      </div>
      <button class="btn ${followed?'btn-soft':'btn-primary'}" type="button" data-onboarding-follow="${esc(profile.id)}" aria-pressed="${followed}">${followed?'Following ✓':'Follow'}</button>
    </article>`;
  }).join('')||'<div class="card empty-state"><h3>No creators found</h3><p>Try a different search.</p></div>';

  $$('[data-onboarding-follow]',target).forEach(button=>button.addEventListener('click',()=>toggleOnboardingFollow(button.dataset.onboardingFollow,button)));
}

async function toggleOnboardingFollow(creatorId,button){
  if(!currentUser||!creatorId)return;
  button.disabled=true;
  const followed=onboardingFollowing.has(creatorId);
  const query=followed
    ? sb.from('creator_follows').delete().eq('follower_id',currentUser.id).eq('creator_id',creatorId)
    : sb.from('creator_follows').insert({follower_id:currentUser.id,creator_id:creatorId});
  const {error}=await query;
  button.disabled=false;
  if(error)return toast(error.message);
  if(followed)onboardingFollowing.delete(creatorId); else onboardingFollowing.add(creatorId);
  renderOnboardingCreators();
  updateOnboardingProgress();
}

async function loadCreatorOnboarding(){
  if(!sb)return toast('Supabase is not configured.');
  if(!currentUser){
    location.replace('index.html');
    return;
  }

  const [profilesResult,followsResult]=await Promise.all([
    sb.from('profiles').select('id,full_name,username,bio,location,avatar_url,is_verified').neq('id',currentUser.id).eq('is_banned',false).order('is_verified',{ascending:false}).limit(100),
    sb.from('creator_follows').select('creator_id').eq('follower_id',currentUser.id)
  ]);
  if(profilesResult.error)return toast(profilesResult.error.message);
  if(followsResult.error)return toast(followsResult.error.message);

  onboardingProfiles=profilesResult.data||[];
  onboardingFollowing=new Set((followsResult.data||[]).map(row=>row.creator_id));
  renderOnboardingCreators();
  updateOnboardingProgress();
}

async function completeCreatorOnboarding(){
  if(onboardingFollowing.size<REQUIRED_CREATOR_FOLLOWS)return;
  const button=$('#completeOnboarding');
  button.disabled=true;
  button.textContent='Finishing…';
  const {error}=await sb.auth.updateUser({data:{creator_onboarding_required:false,creator_onboarding_completed_at:new Date().toISOString()}});
  if(error){
    button.disabled=false;
    button.textContent='Continue to LaunchBoard';
    return toast(error.message);
  }
  location.replace('index.html');
}

document.addEventListener('launchboard:auth-ready',loadCreatorOnboarding,{once:true});
window.addEventListener('DOMContentLoaded',()=>{
  $('#creatorOnboardingSearch')?.addEventListener('input',renderOnboardingCreators);
  $('#completeOnboarding')?.addEventListener('click',completeCreatorOnboarding);
});
