const config = window.LAUNCHBOARD_CONFIG || {};
const configured = config.supabaseUrl?.startsWith('https://') && config.supabaseKey;
const db = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey) : null;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
let adminUsers = [];
let adminProducts = [];
let currentUser = null;

function escapeHTML(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function safeURL(value) { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } }
function formatDate(value) { try { return new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(value)); } catch { return ''; } }
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>el.classList.remove('show'),3200); }
function busy(form, state, text='Please wait…') { const b=form.querySelector('[type="submit"]'); if(!b)return; if(!b.dataset.text)b.dataset.text=b.textContent; b.disabled=state; b.textContent=state?text:b.dataset.text; }

async function verifyAdmin() {
  if (!db) { toast('Configure Supabase in config.js first.'); return false; }
  const { data: sessionData } = await db.auth.getSession();
  currentUser = sessionData.session?.user || null;
  if (!currentUser) return false;
  const { data, error } = await db.from('profiles').select('full_name,is_admin').eq('id', currentUser.id).maybeSingle();
  if (error || !data?.is_admin) {
    await db.auth.signOut();
    currentUser = null;
    toast('Administrator access required.');
    return false;
  }
  $('#adminLoginView').classList.add('hidden');
  $('#adminDashboardView').classList.remove('hidden');
  $('#adminHeaderActions').innerHTML = `<span class="admin-signed-in">${escapeHTML(data.full_name || currentUser.email)}</span><button class="btn btn-ghost" id="adminLogout" type="button">Log out</button>`;
  $('#adminLogout').onclick = async () => { await db.auth.signOut(); location.reload(); };
  return true;
}

async function loadDashboard() {
  if (!(await verifyAdmin())) return;
  const [statsRes, usersRes, productsRes] = await Promise.all([
    db.rpc('admin_dashboard_stats'), db.rpc('admin_list_users'), db.rpc('admin_list_products')
  ]);
  const err = statsRes.error || usersRes.error || productsRes.error;
  if (err) return toast(err.message);
  const stats = statsRes.data || {};
  $('#adminUsers').textContent = stats.users ?? 0;
  $('#adminProducts').textContent = stats.products ?? 0;
  $('#adminClicks').textContent = stats.clicks ?? 0;
  $('#adminBanned').textContent = stats.banned_users ?? 0;
  $('#adminToday').textContent = stats.products_today ?? 0;
  adminUsers = usersRes.data || [];
  adminProducts = productsRes.data || [];
  renderProducts(); renderUsers();
}

function renderProducts() {
  const panel=$('#adminProductsPanel');
  if(!adminProducts.length){ panel.innerHTML='<p class="admin-empty">No products found.</p>'; return; }
  panel.innerHTML=`<table class="admin-table"><thead><tr><th>Product</th><th>Owner</th><th>Category</th><th>Clicks</th><th>Published</th><th></th></tr></thead><tbody>${adminProducts.map(p=>`<tr><td><span class="admin-title">${escapeHTML(p.title)}</span><span class="admin-sub">${escapeHTML(p.creator)}</span></td><td>${escapeHTML(p.owner_email||'Unknown')}</td><td>${escapeHTML(p.category)}</td><td>${p.clicks||0}</td><td>${formatDate(p.created_at)}</td><td><div class="admin-actions"><a class="btn btn-ghost btn-small" href="${safeURL(p.product_url)}" target="_blank" rel="noopener">Check link</a><button class="btn btn-danger btn-small admin-delete" data-id="${p.id}" type="button">Delete spam</button></div></td></tr>`).join('')}</tbody></table>`;
  panel.querySelectorAll('.admin-delete').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.id));
}

function renderUsers() {
  const panel=$('#adminUsersPanel');
  if(!adminUsers.length){ panel.innerHTML='<p class="admin-empty">No users found.</p>'; return; }
  panel.innerHTML=`<table class="admin-table"><thead><tr><th>User</th><th>Joined</th><th>Products</th><th>Clicks</th><th>Status</th><th></th></tr></thead><tbody>${adminUsers.map(u=>`<tr><td><span class="admin-title">${escapeHTML(u.full_name||'Unnamed user')}</span><span class="admin-sub">${escapeHTML(u.email||'')}</span></td><td>${formatDate(u.created_at)}</td><td>${u.product_count||0}</td><td>${u.total_clicks||0}</td><td><span class="status-pill ${u.is_banned?'banned':''}">${u.is_admin?'Administrator':u.is_banned?'Banned':'Active'}</span></td><td><div class="admin-actions">${u.is_admin?'':`<button class="btn ${u.is_banned?'btn-ghost':'btn-danger'} btn-small admin-ban" data-id="${u.id}" data-banned="${u.is_banned}" type="button">${u.is_banned?'Unban':'Ban user'}</button>`}</div></td></tr>`).join('')}</tbody></table>`;
  panel.querySelectorAll('.admin-ban').forEach(b=>b.onclick=()=>setBan(b.dataset.id,b.dataset.banned!=='true'));
}

async function deleteProduct(id) {
  const p=adminProducts.find(x=>x.id===id);
  if(!p||!confirm(`Delete “${p.title}”? This cannot be undone.`))return;
  const {error}=await db.rpc('admin_delete_product',{target_product_id:id});
  if(error)return toast(error.message); toast('Spam product deleted.'); await loadDashboard();
}
async function setBan(id,banned) {
  const u=adminUsers.find(x=>x.id===id); const verb=banned?'Ban':'Unban';
  if(!u||!confirm(`${verb} ${u.email}?`))return;
  const {error}=await db.rpc('admin_set_user_ban',{target_user_id:id,banned});
  if(error)return toast(error.message); toast(banned?'User banned.':'User restored.'); await loadDashboard();
}

$('#adminLoginForm').addEventListener('submit', async e=>{
  e.preventDefault(); if(!db)return toast('Configure Supabase first.');
  const form=e.currentTarget, fd=new FormData(form); busy(form,true,'Signing in…');
  const {error}=await db.auth.signInWithPassword({email:String(fd.get('email')).trim().toLowerCase(),password:String(fd.get('password'))});
  busy(form,false); if(error)return toast(error.message); if(await verifyAdmin()) await loadDashboard();
});
$('#adminRefresh').onclick=loadDashboard;
$$('[data-admin-tab]').forEach(btn=>btn.onclick=()=>{
  $$('[data-admin-tab]').forEach(x=>x.classList.toggle('active',x===btn));
  $('#adminProductsPanel').classList.toggle('hidden',btn.dataset.adminTab!=='products');
  $('#adminUsersPanel').classList.toggle('hidden',btn.dataset.adminTab!=='users');
});
(async()=>{ if(await verifyAdmin()) await loadDashboard(); })();
