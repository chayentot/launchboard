const LAUNCHBOARD_BUILD='9.3.0';
console.info('LaunchBoard build',LAUNCHBOARD_BUILD);
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));

const cfg=window.LAUNCHBOARD_CONFIG||{};
const sb=(window.supabase&&cfg.supabaseUrl&&cfg.supabaseKey)
  ? window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey)
  : null;

let currentUser=null;
let currentProfile=null;
let authReady=false;

function esc(value=''){
  return String(value).replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);
}


function formatPeso(value){
  const raw=String(value??'').trim();
  if(!raw)return 'Contact for price';
  if(/^₱/.test(raw))return raw;
  const cleaned=raw.replace(/[,\s]/g,'').replace(/^(php|PHP)/,'');
  if(/^\d+(\.\d{1,2})?$/.test(cleaned)){
    return new Intl.NumberFormat('en-PH',{
      style:'currency',
      currency:'PHP',
      minimumFractionDigits:Number(cleaned)%1===0?0:2,
      maximumFractionDigits:2
    }).format(Number(cleaned));
  }
  return raw;
}

function safeUrl(value,fallback='#'){
  try{
    const url=new URL(String(value||''),location.href);
    return ['http:','https:'].includes(url.protocol)?url.href:fallback;
  }catch{
    return fallback;
  }
}

function badge(profile){
  return profile?.is_verified
    ? '<span class="verified" title="Verified creator" aria-label="Verified creator">✓</span>'
    : '';
}

function toast(message,type='error'){
  const el=$('#toast');
  if(!el){
    alert(String(message||'Something went wrong.'));
    return;
  }
  el.textContent=String(message||'Something went wrong.');
  el.className=`toast show ${type}`;
  el.setAttribute('role','alert');
  el.setAttribute('aria-live','assertive');
  clearTimeout(el._timer);
  el._timer=setTimeout(()=>el.classList.remove('show'),6000);

  const dialog=document.querySelector('dialog[open]');
  if(dialog){
    let inline=dialog.querySelector('.inline-alert');
    if(!inline){
      inline=document.createElement('div');
      inline.className='inline-alert';
      inline.setAttribute('role','alert');
      const form=dialog.querySelector('form');
      (form||dialog).prepend(inline);
    }
    inline.textContent=el.textContent;
    inline.hidden=false;
    clearTimeout(inline._timer);
    inline._timer=setTimeout(()=>inline.hidden=true,7000);
  }
}

async function fetchProfile(userId){
  if(!sb||!userId)return null;
  const {data,error}=await sb.from('profiles').select('*').eq('id',userId).maybeSingle();
  if(error){
    console.error('Profile load failed:',error);
    return null;
  }
  return data||null;
}

async function refreshIdentity(){
  if(!sb){
    authReady=true;
    renderNav();
    document.dispatchEvent(new CustomEvent('launchboard:auth-ready'));
    return;
  }
  const {data,error}=await sb.auth.getSession();
  if(error)console.error('Session load failed:',error);
  currentUser=data?.session?.user||null;
  currentProfile=currentUser?await fetchProfile(currentUser.id):null;
  authReady=true;
  renderNav();
  document.dispatchEvent(new CustomEvent('launchboard:auth-ready'));
}

async function getOnboardingState(userId=currentUser?.id){
  if(!sb||!userId)return null;
  const {data,error}=await sb
    .from('profiles')
    .select('onboarding_completed,following_count')
    .eq('id',userId)
    .maybeSingle();
  if(error){
    console.error('Onboarding state failed:',error);
    return null;
  }
  return data||null;
}

async function initializeNewUserProfile(user,fullName=''){
  if(!sb||!user)return false;
  const payload={
    id:user.id,
    full_name:String(fullName||user.user_metadata?.full_name||'').trim(),
    onboarding_completed:false,
    following_count:0
  };

  // Most LaunchBoard databases create profiles through an auth trigger.
  // Upsert also covers projects where that trigger is not installed.
  const {error}=await sb.from('profiles').upsert(payload,{onConflict:'id'});
  if(error){
    console.error('New profile initialization failed:',error);
    return false;
  }
  currentProfile={...(currentProfile||{}),...payload};
  return true;
}

async function enforceCreatorOnboarding(){
  if(!sb||!currentUser)return;
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const allowedPages=new Set([
    'onboarding.html','reset-password.html','privacy.html','terms.html',
    'guidelines.html','support.html'
  ]);
  if(allowedPages.has(page))return;

  const state=await getOnboardingState(currentUser.id);
  if(!state){
    // Do not lock out users if the V9.3 SQL migration has not been installed.
    console.warn('LaunchBoard onboarding state is unavailable. Run launchboard-v9.3.sql.');
    return;
  }

  if(state.onboarding_completed!==true){
    location.replace('onboarding.html');
  }
}

async function boot(){
  await refreshIdentity();
  await enforceCreatorOnboarding();

  if(!sb)return;
  sb.auth.onAuthStateChange(async(event,session)=>{
    currentUser=session?.user||null;
    currentProfile=currentUser?await fetchProfile(currentUser.id):null;
    renderNav();
    await enforceCreatorOnboarding();
    document.dispatchEvent(new CustomEvent('launchboard:auth-changed',{detail:{event}}));
    // Deliberately no location.reload(): prevents authentication refresh loops.
  });
}

function renderNav(){
  const actions=$('#navActions');
  if(!actions)return;

  if(currentUser){
    actions.innerHTML=`
      <a class="btn btn-ghost hide-mobile" href="dashboard.html">Dashboard</a>
      <a class="btn btn-ghost" href="messages.html">Messages</a>
      <button class="btn btn-primary" id="logout" type="button">Log out</button>`;
  }else{
    actions.innerHTML=`
      <button class="btn btn-ghost" data-open="loginModal" type="button">Log in</button>
      <button class="btn btn-primary" data-open="signupModal" type="button">Join free</button>`;
  }

  $('#logout')?.addEventListener('click',async()=>{
    const {error}=await sb.auth.signOut();
    if(error)return toast(error.message);
    location.href='index.html';
  });

  $$('[data-open]').forEach(button=>{
    button.onclick=()=>$('#'+button.dataset.open)?.showModal();
  });
}

async function loginSubmit(event){
  event.preventDefault();
  if(!sb)return toast('Supabase is not configured.');
  const form=event.currentTarget;
  const button=event.submitter||form.querySelector('button[type="submit"],button');
  const data=new FormData(form);
  button.disabled=true;
  const {error}=await sb.auth.signInWithPassword({
    email:String(data.get('email')||'').trim(),
    password:String(data.get('password')||'')
  });
  button.disabled=false;
  if(error)return toast(error.message);
  form.closest('dialog')?.close();
  toast('Logged in.','success');
}

async function signupSubmit(event){
  event.preventDefault();
  if(!sb)return toast('Supabase is not configured.');
  const form=event.currentTarget;
  const button=event.submitter||form.querySelector('button[type="submit"],button');
  const data=new FormData(form);
  button.disabled=true;
  const fullName=String(data.get('name')||'').trim();
  const {data:signupData,error}=await sb.auth.signUp({
    email:String(data.get('email')||'').trim(),
    password:String(data.get('password')||''),
    options:{data:{full_name:fullName}}
  });
  button.disabled=false;
  if(error)return toast(error.message);

  if(!signupData?.session?.user){
    return toast('Signup succeeded but no session was created. Turn off Confirm email in Supabase Authentication → Providers → Email.');
  }

  await initializeNewUserProfile(signupData.session.user,fullName);
  form.closest('dialog')?.close();
  form.reset();
  toast('Welcome to LaunchBoard! Choose 5 creators to continue.','success');
  setTimeout(()=>location.replace('onboarding.html'),250);
}


function openReportDialog(targetType,targetId){
  if(!currentUser)return toast('Please log in before submitting a report.');
  $('#reportTargetType').value=targetType;
  $('#reportTargetId').value=targetId;
  $('#reportModal').showModal();
}

async function submitReport(event){
  event.preventDefault();
  const form=event.currentTarget;
  const data=new FormData(form);
  const {error}=await sb.from('reports').insert({
    reporter_id:currentUser.id,
    target_type:data.get('target_type'),
    target_id:data.get('target_id'),
    reason:data.get('reason'),
    details:String(data.get('details')||'').trim()
  });
  if(error)return toast(error.message);
  form.reset();
  $('#reportModal').close();
  toast('Report submitted for review.','success');
}

async function requestPasswordReset(event){
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const redirectTo=new URL('reset-password.html',location.href).href;
  const {error}=await sb.auth.resetPasswordForEmail(String(data.get('email')||'').trim(),{redirectTo});
  if(error)return toast(error.message);
  $('#forgotPasswordModal').close();
  toast('Password reset email sent.','success');
}

async function updatePassword(event){
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const {error}=await sb.auth.updateUser({password:String(data.get('password')||'')});
  if(error)return toast(error.message);
  $('#newPasswordModal').close();
  toast('Password updated successfully.','success');
  setTimeout(()=>location.href='index.html',900);
}

function installExternalLinkWarning(){
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link)return;
    const url=safeUrl(link.href,'');
    if(!url)return;
    const parsed=new URL(url);
    if(parsed.origin===location.origin)return;
    if(link.dataset.noWarning==='true')return;
    const confirmed=window.confirm('You are leaving LaunchBoard and opening an external website. Continue?');
    if(!confirmed)event.preventDefault();
  });
}

window.addEventListener('DOMContentLoaded',()=>{
  boot();
  $('#loginForm')?.addEventListener('submit',loginSubmit);
  $('#signupForm')?.addEventListener('submit',signupSubmit);
  $('#reportForm')?.addEventListener('submit',submitReport);
  $('#forgotPasswordForm')?.addEventListener('submit',requestPasswordReset);
  $('#newPasswordForm')?.addEventListener('submit',updatePassword);
  $('#forgotPasswordButton')?.addEventListener('click',()=>{$('#loginModal')?.close();$('#forgotPasswordModal')?.showModal();});
  $$('[data-close-dialog]').forEach(button=>button.onclick=()=>button.closest('dialog')?.close());
  installExternalLinkWarning();
  $$('dialog').forEach(dialog=>{
    dialog.addEventListener('click',event=>{
      if(event.target===dialog)dialog.close();
    });
  });
});


/* =========================================================
   V6 MOBILE COMMERCE NAVIGATION
   ========================================================= */
(function(){
  const MOBILE_QUERY='(max-width:760px)';

  function page(){
    return (location.pathname.split('/').pop()||'index.html').toLowerCase();
  }

  function navItems(){
    return [
      ['index.html','⌂','Home'],
      ['messages.html','✉','Message'],
      ['dashboard.html?publish=1','＋','Sell'],
      ['notifications.html','♢','Notification'],
      ['dashboard.html','◎','Profile']
    ];
  }

  function installBottomNavigation(){
    document.querySelectorAll('.mobile-bottom-nav').forEach((existing,index)=>{
      if(index>0)existing.remove();
    });

    let nav=document.querySelector('.mobile-bottom-nav');

    if(!nav){
      nav=document.createElement('nav');
      nav.className='mobile-bottom-nav';
      nav.setAttribute('aria-label','Mobile navigation');
      document.body.appendChild(nav);
    }

    nav.innerHTML=navItems().map(([href,icon,label])=>
      `<a href="${href}" data-mobile-destination="${label.toLowerCase()}"><span>${icon}</span><small>${label}</small></a>`
    ).join('');

    const current=page();
    const active=current==='dashboard.html'
      ? (new URLSearchParams(location.search).get('publish')==='1'?'sell':'profile')
      : current==='messages.html'
        ? 'message'
        : current==='notifications.html'
          ? 'notification'
          : 'home';

    nav.querySelector(`[data-mobile-destination="${active}"]`)?.classList.add('active');
  }

  function installBackButton(){
    if(page()==='index.html'||page()==='dashboard.html')return;

    const header=document.querySelector('.topbar .nav');
    if(!header||document.getElementById('mobileBackButton'))return;

    const button=document.createElement('button');
    button.id='mobileBackButton';
    button.className='mobile-back-button';
    button.type='button';
    button.setAttribute('aria-label','Back to Home');
    button.innerHTML='<span aria-hidden="true">‹</span>';

    button.addEventListener('click',()=>location.replace('index.html'));
    header.insertBefore(button,header.firstChild);
  }

  function addPageClass(){
    document.documentElement.classList.add('launchboard-v6');
    document.body.classList.add(`page-${page().replace('.html','')}`);
  }

  function start(){
    addPageClass();
    installBottomNavigation();
    installBackButton();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start,{once:true});
  }else{
    start();
  }
})();


/* V7 guest login/sign-up visibility */
(function(){
  function updateGuestActions(){
    const actions=$('#mobileGuestActions');
    if(!actions)return;
    actions.hidden=Boolean(currentUser);
  }

  function start(){
    $('#mobileGuestLogin')?.addEventListener('click',()=>$('#loginModal')?.showModal?.());
    $('#mobileGuestSignup')?.addEventListener('click',()=>$('#signupModal')?.showModal?.());
    updateGuestActions();
    document.addEventListener('launchboard:auth-ready',updateGuestActions);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start,{once:true});
  }else{
    start();
  }
})();


/* =========================================================
   V7.3 ANDROID BACK PRIORITY
   1. Close open dialog/sheet
   2. Close an open Messenger chat
   3. Return inner pages to Home
   4. Double Back exits from Home
   ========================================================= */
(function(){
  function page(){
    return (location.pathname.split('/').pop()||'index.html').toLowerCase();
  }

  let lastHomeBackPress=0;

  function closeOpenLayer(){
    const dialog=document.querySelector('dialog[open]');
    if(dialog){
      dialog.close();
      return true;
    }

    if(window.LaunchBoardMessages?.isChatOpen?.()){
      window.LaunchBoardMessages.closeChat();
      history.replaceState(null,'','messages.html');
      return true;
    }

    return false;
  }

  function showExitHint(){
    if(typeof toast==='function')toast('Press Back again to exit.');
  }

  function handleBack(){
    if(closeOpenLayer())return;

    const current=page();
    const capacitorApp=window.Capacitor?.Plugins?.App;

    if(current!=='index.html'){
      location.href='index.html';
      return;
    }

    const now=Date.now();
    if(now-lastHomeBackPress<1800){
      capacitorApp?.exitApp?.();
      return;
    }

    lastHomeBackPress=now;
    showExitHint();
  }

  function installCapacitor(){
    const app=window.Capacitor?.Plugins?.App;
    if(!app?.addListener)return false;
    app.addListener('backButton',handleBack);
    return true;
  }

  function installBrowserFallback(){
    if(!matchMedia('(max-width:760px)').matches)return;

    history.replaceState({launchboard:true},'',location.href);
    history.pushState({launchboardGuard:true},'',location.href);

    addEventListener('popstate',()=>{
      if(closeOpenLayer()){
        history.pushState({launchboardGuard:true},'',location.href);
        return;
      }

      if(page()!=='index.html'){
        location.replace('index.html');
        return;
      }

      history.pushState({launchboardGuard:true},'',location.href);
      const now=Date.now();
      if(now-lastHomeBackPress<1800){
        window.close();
      }else{
        lastHomeBackPress=now;
        showExitHint();
      }
    });
  }

  function start(){
    if(!installCapacitor())installBrowserFallback();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start,{once:true});
  }else{
    start();
  }
})();


async function refreshMobileNotificationBadge(){
  if(!currentUser||!sb)return;

  const {count,error}=await sb
    .from('notifications')
    .select('id',{count:'exact',head:true})
    .eq('user_id',currentUser.id)
    .eq('is_read',false);

  if(error){
    console.warn('Notification badge failed:',error);
    return;
  }

  const link=document.querySelector('[data-mobile-destination="notification"]');
  if(!link)return;

  let badge=link.querySelector('.mobile-nav-badge');

  if((count||0)>0){
    if(!badge){
      badge=document.createElement('span');
      badge.className='mobile-nav-badge';
      link.appendChild(badge);
    }
    badge.textContent=count>99?'99+':String(count);
  }else{
    badge?.remove();
  }
}

document.addEventListener('launchboard:auth-ready',refreshMobileNotificationBadge);
document.addEventListener('launchboard:notifications-changed',refreshMobileNotificationBadge);

