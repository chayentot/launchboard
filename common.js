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

window.addEventListener('DOMContentLoaded',()=>{
  boot();
  $('#loginForm')?.addEventListener('submit',loginSubmit);
  $('#signupForm')?.addEventListener('submit',signupSubmit);
  $$('dialog').forEach(dialog=>{
    dialog.addEventListener('click',event=>{
      if(event.target===dialog)dialog.close();
    });
  });
});
