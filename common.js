const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const cfg=window.LAUNCHBOARD_CONFIG||{};
const sb=(window.supabase&&cfg.supabaseUrl&&cfg.supabaseKey)?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey):null;
let currentUser=null,currentProfile=null,authReady=false;
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function badge(p){return p?.is_verified?'<span class="verified" title="Verified creator">✓</span>':''}
function toast(message,type='error'){
 const el=$('#toast'); if(!el)return alert(message); el.textContent=message; el.className=`toast show ${type}`; el.setAttribute('role','alert');
 clearTimeout(el._timer); el._timer=setTimeout(()=>el.classList.remove('show'),6000);
 const d=document.querySelector('dialog[open]'); if(d){let x=d.querySelector('.inline-alert');if(!x){x=document.createElement('div');x.className='inline-alert';d.querySelector('form')?.prepend(x)}x.textContent=message;x.hidden=false;clearTimeout(x._timer);x._timer=setTimeout(()=>x.hidden=true,7000)}
}
async function refreshIdentity(){
 if(!sb){authReady=true;renderNav();return}
 const {data:{session}}=await sb.auth.getSession(); currentUser=session?.user||null; currentProfile=null;
 if(currentUser){const {data}=await sb.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();currentProfile=data||null}
 authReady=true;renderNav();document.dispatchEvent(new CustomEvent('launchboard:auth-ready'));
}
async function boot(){
 await refreshIdentity();
 if(sb)sb.auth.onAuthStateChange(async(event,session)=>{
   currentUser=session?.user||null; currentProfile=null;
   if(currentUser){const {data}=await sb.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();currentProfile=data||null}
   renderNav();document.dispatchEvent(new CustomEvent('launchboard:auth-changed',{detail:{event}}));
 });
}
function renderNav(){const a=$('#navActions');if(!a)return;if(currentUser)a.innerHTML=`<a class="btn btn-ghost hide-mobile" href="dashboard.html">Dashboard</a><a class="btn btn-ghost" href="messages.html">Messages</a><button class="btn btn-primary" id="logout">Log out</button>`;else a.innerHTML=`<button class="btn btn-ghost" data-open="loginModal">Log in</button><button class="btn btn-primary" data-open="signupModal">Join free</button>`;$('#logout')?.addEventListener('click',async()=>{await sb.auth.signOut();location.href='index.html'});$$('[data-open]').forEach(b=>b.onclick=()=>$('#'+b.dataset.open)?.showModal())}
async function loginSubmit(e){e.preventDefault();const b=e.submitter||e.target.querySelector('button');b.disabled=true;const f=new FormData(e.target);const {error}=await sb.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});b.disabled=false;if(error)return toast(error.message);e.target.closest('dialog')?.close();toast('Logged in.','success')}
async function signupSubmit(e){e.preventDefault();const b=e.submitter||e.target.querySelector('button');b.disabled=true;const f=new FormData(e.target);const {error}=await sb.auth.signUp({email:f.get('email'),password:f.get('password'),options:{data:{full_name:f.get('name')}}});b.disabled=false;if(error)return toast(error.message);e.target.closest('dialog')?.close();toast('Account created. Check your email if confirmation is enabled.','success')}
window.addEventListener('DOMContentLoaded',()=>{boot();$('#loginForm')?.addEventListener('submit',loginSubmit);$('#signupForm')?.addEventListener('submit',signupSubmit);$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}))});
