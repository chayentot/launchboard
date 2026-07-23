const REQUIRED_FOLLOWS=5;
let onboardingProfiles=[];
let followedIds=new Set();

function onboardingAvatar(profile){
  if(profile.avatar_url){
    return `<img src="${esc(safeUrl(profile.avatar_url,''))}" alt="${esc(profile.full_name||profile.username||'Creator')}">`;
  }
  return esc((profile.full_name||profile.username||'?').slice(0,1).toUpperCase());
}

function updateOnboardingProgress(){
  const count=followedIds.size;
  const complete=count>=REQUIRED_FOLLOWS;
  $('#onboardingProgressText').textContent=`${count} of ${REQUIRED_FOLLOWS} followed`;
  $('#onboardingStatus').textContent=complete?'Ready to continue':`Choose ${REQUIRED_FOLLOWS-count} more`;
  $('#onboardingProgressBar').style.width=`${Math.min(100,count/REQUIRED_FOLLOWS*100)}%`;
  $('#finishOnboarding').disabled=!complete;
}

function renderOnboardingCreators(){
  const query=$('#creatorSearch').value.trim().toLowerCase();
  const rows=onboardingProfiles.filter(profile=>[
    profile.full_name,profile.username,profile.bio,profile.location
  ].join(' ').toLowerCase().includes(query));

  $('#onboardingCreatorGrid').innerHTML=rows.map(profile=>{
    const following=followedIds.has(profile.id);
    return `<article class="card onboarding-creator">
      <span class="onboarding-avatar">${onboardingAvatar(profile)}</span>
      <span class="onboarding-copy"><strong>${esc(profile.full_name||profile.username||'Creator')} ${badge(profile)}</strong><small>${esc(profile.bio||profile.location||'Independent creator')}</small></span>
      <button class="btn ${following?'btn-soft':'btn-primary'} onboarding-follow" type="button" data-creator-id="${esc(profile.id)}" aria-pressed="${following}">${following?'Following':'Follow'}</button>
    </article>`;
  }).join('')||'<div class="card onboarding-empty"><p>No creators match your search.</p></div>';

  $$('.onboarding-follow').forEach(button=>button.addEventListener('click',()=>toggleCreatorFollow(button)));
}

async function syncProfileProgress(){
  const count=followedIds.size;
  const completed=count>=REQUIRED_FOLLOWS;
  // The SQL trigger is the source of truth. This update gives immediate UI
  // feedback in projects whose trigger deployment is delayed.
  const {error}=await sb.from('profiles').update({
    following_count:count,
    onboarding_completed:completed
  }).eq('id',currentUser.id);
  if(error)console.warn('Profile onboarding sync failed:',error);
  currentProfile={...(currentProfile||{}),following_count:count,onboarding_completed:completed};
}

async function toggleCreatorFollow(button){
  if(button.disabled)return;
  const creatorId=button.dataset.creatorId;
  const wasFollowing=followedIds.has(creatorId);
  button.disabled=true;

  const result=wasFollowing
    ? await sb.from('creator_follows').delete().eq('follower_id',currentUser.id).eq('creator_id',creatorId)
    : await sb.from('creator_follows').insert({follower_id:currentUser.id,creator_id:creatorId});

  button.disabled=false;
  if(result.error)return toast(result.error.message);
  wasFollowing?followedIds.delete(creatorId):followedIds.add(creatorId);
  await syncProfileProgress();
  updateOnboardingProgress();
  renderOnboardingCreators();
}

async function loadOnboarding(){
  if(!sb)return toast('Supabase is not configured.');
  if(!authReady)await new Promise(resolve=>document.addEventListener('launchboard:auth-ready',resolve,{once:true}));
  if(!currentUser){
    location.replace('index.html');
    return;
  }

  const [profilesResult,followsResult,stateResult]=await Promise.all([
    sb.from('profiles').select('id,full_name,username,bio,location,avatar_url,is_verified,is_banned').neq('id',currentUser.id).eq('is_banned',false).order('is_verified',{ascending:false}),
    sb.from('creator_follows').select('creator_id').eq('follower_id',currentUser.id),
    sb.from('profiles').select('onboarding_completed,following_count').eq('id',currentUser.id).maybeSingle()
  ]);

  if(profilesResult.error)return toast(profilesResult.error.message);
  if(followsResult.error)return toast(followsResult.error.message);
  if(stateResult.error)return toast('Run launchboard-v9.3.sql before using onboarding.');

  onboardingProfiles=profilesResult.data||[];
  followedIds=new Set((followsResult.data||[]).map(row=>row.creator_id));

  if(stateResult.data?.onboarding_completed===true&&followedIds.size>=REQUIRED_FOLLOWS){
    location.replace('index.html');
    return;
  }

  updateOnboardingProgress();
  renderOnboardingCreators();
}

$('#creatorSearch')?.addEventListener('input',renderOnboardingCreators);
$('#finishOnboarding')?.addEventListener('click',async()=>{
  if(followedIds.size<REQUIRED_FOLLOWS)return;
  await syncProfileProgress();
  location.replace('index.html');
});

document.addEventListener('DOMContentLoaded',loadOnboarding);
