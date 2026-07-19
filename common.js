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

async function boot(){
  await refreshIdentity();

  if(!sb)return;
  sb.auth.onAuthStateChange(async(event,session)=>{
    currentUser=session?.user||null;
    currentProfile=currentUser?await fetchProfile(currentUser.id):null;
    renderNav();
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

  renderMobileMenu();
}

function renderMobileMenu(){
  const links=$('#mobileMenuLinks');
  if(!links)return;

  if(currentUser){
    links.innerHTML=`
      <a href="dashboard.html"><span>Dashboard</span><small>Manage products and profile</small></a>
      <a href="messages.html"><span>Messages</span><small>Open your conversations</small></a>
      <a href="creator.html?id=${encodeURIComponent(currentUser.id)}"><span>Creator profile</span><small>View your public page</small></a>
      <button id="mobileLogout" type="button"><span>Log out</span><small>Sign out of LaunchBoard</small></button>`;
  }else{
    links.innerHTML=`
      <button data-open-mobile="loginModal" type="button"><span>Log in</span><small>Access your account</small></button>
      <button data-open-mobile="signupModal" type="button"><span>Join free</span><small>Create a LaunchBoard account</small></button>`;
  }

  $('#mobileLogout')?.addEventListener('click',async()=>{
    const {error}=await sb.auth.signOut();
    if(error)return toast(error.message);
    location.href='index.html';
  });

  $$('[data-open-mobile]',links).forEach(button=>{
    button.addEventListener('click',()=>{
      $('#mobileMenu')?.close();
      $('#'+button.dataset.openMobile)?.showModal();
    });
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
  const {error}=await sb.auth.signUp({
    email:String(data.get('email')||'').trim(),
    password:String(data.get('password')||''),
    options:{data:{full_name:String(data.get('name')||'').trim()}}
  });
  button.disabled=false;
  if(error)return toast(error.message);
  form.closest('dialog')?.close();
  toast('Account created. Check your email if confirmation is enabled.','success');
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

  const openMobileMenu=()=>$('#mobileMenu')?.showModal();
  $('#mobileMenuButton')?.addEventListener('click',openMobileMenu);
  $('#bottomProfileButton')?.addEventListener('click',openMobileMenu);
  $('[data-close-mobile-menu]')?.addEventListener('click',()=>$('#mobileMenu')?.close());
});


/* V5.1 mobile back button for inner pages */
function installMobileBackButton(){
  const path=(location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isHome=path==='' || path==='index.html';
  if(isHome || document.getElementById('mobileBackButton'))return;

  const nav=document.querySelector('.topbar .nav');
  if(!nav)return;

  const button=document.createElement('button');
  button.id='mobileBackButton';
  button.className='mobile-back-button';
  button.type='button';
  button.setAttribute('aria-label','Go back');
  button.innerHTML='<span aria-hidden="true">‹</span>';

  button.addEventListener('click',()=>{
    if(history.length>1){
      history.back();
    }else{
      location.href='index.html';
    }
  });

  nav.insertBefore(button,nav.firstChild);
}

document.addEventListener('DOMContentLoaded',installMobileBackButton);
