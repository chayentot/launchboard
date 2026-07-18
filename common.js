const cfg=window.LAUNCHBOARD_CONFIG||{};const sb=(cfg.supabaseUrl&&cfg.supabaseKey&&window.supabase)?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey):null;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let currentUser=null,currentProfile=null;
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function toast(m){
  const activeDialog=document.querySelector('dialog[open]');
  if(activeDialog){
    let inlineError=activeDialog.querySelector('.auth-error-message');
    if(!inlineError){
      inlineError=document.createElement('div');
      inlineError.className='auth-error-message';
      inlineError.setAttribute('role','alert');
      inlineError.setAttribute('aria-live','assertive');
      const form=activeDialog.querySelector('form');
      if(form)form.appendChild(inlineError);
      else activeDialog.appendChild(inlineError);
    }
    inlineError.textContent=String(m||'Something went wrong.');
    inlineError.classList.add('visible');
    clearTimeout(inlineError._hideTimer);
    inlineError._hideTimer=setTimeout(()=>inlineError.classList.remove('visible'),7000);
  }
const t=$('#toast');if(!t)return; t.textContent=m;t.style.display='block';clearTimeout(window._tt);window._tt=setTimeout(()=>t.style.display='none',3300)}
function safeUrl(u){try{const x=new URL(u);return ['http:','https:'].includes(x.protocol)?x.href:'#'}catch{return '#'}}
function badge(p){return p?.is_verified?'<span class="verified" title="Verified creator">●</span>':''}
async function boot(){if(!sb)return;const {data}=await sb.auth.getSession();currentUser=data.session?.user||null;if(currentUser){const r=await sb.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();currentProfile=r.data||null}renderNav();sb.auth.onAuthStateChange(()=>location.reload())}
function renderNav(){const a=$('#navActions');if(!a)return;if(currentUser)a.innerHTML=`<a class="btn btn-ghost hide-mobile" href="dashboard.html">Dashboard</a><a class="btn btn-ghost" href="messages.html">Messages</a><button class="btn btn-primary" id="logout">Log out</button>`;else a.innerHTML=`<button class="btn btn-ghost" onclick="document.querySelector('#loginModal').showModal()">Log in</button><button class="btn btn-primary" onclick="document.querySelector('#signupModal').showModal()">Join free</button>`;$('#logout')?.addEventListener('click',async()=>{await sb.auth.signOut();location.href='index.html'})}
async function loginSubmit(e){e.preventDefault();const f=new FormData(e.target);const {error}=await sb.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)return toast(error.message);location.reload()}
async function signupSubmit(e){e.preventDefault();const f=new FormData(e.target);const {error}=await sb.auth.signUp({email:f.get('email'),password:f.get('password'),options:{data:{full_name:f.get('name')}}});if(error)return toast(error.message);toast('Account created. Check email if confirmation is enabled.');e.target.closest('dialog').close()}
window.addEventListener('DOMContentLoaded',()=>{boot();$('#loginForm')?.addEventListener('submit',loginSubmit);$('#signupForm')?.addEventListener('submit',signupSubmit);$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}))});
