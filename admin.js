let users=[],items=[];
async function loadAdmin(){if(!currentUser)return;const {data:me}=await sb.from('profiles').select('is_admin').eq('id',currentUser.id).single();if(!me?.is_admin){$('#gate').innerHTML='<h1>Access denied</h1><p>This account is not an administrator.</p>';return}$('#gate').hidden=true;$('#adminApp').hidden=false;const [u,p,s]=await Promise.all([sb.rpc('admin_list_users'),sb.rpc('admin_list_products'),sb.rpc('admin_dashboard_stats')]);if(u.error||p.error)return toast(u.error?.message||p.error?.message);users=u.data||[];items=p.data||[];const st=s.data||{};$('#adminStats').innerHTML=Object.entries({Users:st.users||users.length,Products:st.products||items.length,Clicks:st.clicks||0,'Banned users':st.banned_users||0,'Products today':st.products_today||0}).map(([k,v])=>`<div class="card stat-card"><span class="muted">${k}</span><strong>${v}</strong></div>`).join('');renderUsers();renderProducts()}
function renderUsers(){const q=$('#userSearch').value.toLowerCase();$('#users').innerHTML=users.filter(x=>[x.full_name,x.email,x.username].join(' ').toLowerCase().includes(q)).map(x=>`<div class="review"><div class="row between"><div><strong>${esc(x.full_name||x.email)} ${x.is_verified?'<span class="verified">●</span>':''}</strong><div class="muted">${esc(x.email||'')} ${x.is_banned?'· BANNED':''}</div></div><div><button class="btn btn-soft" onclick="verifyUser('${x.id}',${!x.is_verified})">${x.is_verified?'Unverify':'Verify'}</button><button class="btn btn-ghost" onclick="banUser('${x.id}',${!x.is_banned})">${x.is_banned?'Unban':'Ban'}</button></div></div></div>`).join('')}
function renderProducts(){const q=$('#productSearch').value.toLowerCase();$('#products').innerHTML=items.filter(x=>[x.title,x.creator,x.category].join(' ').toLowerCase().includes(q)).map(x=>`<div class="review"><strong>${esc(x.title)}</strong><div class="muted">${esc(x.creator)} · ${x.clicks||0} clicks ${x.is_premium?'· PREMIUM':''}</div><div class="row"><button class="btn btn-soft" onclick="premium('${x.id}',${!x.is_premium})">${x.is_premium?'Remove premium':'Make premium'}</button><button class="btn btn-ghost" onclick="removeProduct('${x.id}')">Delete spam</button></div></div>`).join('')}
async function verifyUser(id,v){const {error}=await sb.rpc('admin_set_verified',{target_user:id,new_value:v});if(error)return toast(error.message);loadAdmin()}
async function premium(id,v){const {error}=await sb.rpc('admin_set_premium',{target_product:id,new_value:v,days_count:30});if(error)return toast(error.message);loadAdmin()}
async function banUser(id,v){const {error}=await sb.rpc('admin_set_user_banned',{target_user_id:id,banned:v});if(error)return toast(error.message);loadAdmin()}
async function removeProduct(id){if(!confirm('Delete this product permanently?'))return;const {error}=await sb.from('products').delete().eq('id',id);if(error)return toast(error.message);loadAdmin()}
window.verifyUser=verifyUser;window.premium=premium;window.banUser=banUser;window.removeProduct=removeProduct;window.addEventListener('DOMContentLoaded',()=>{$('#userSearch').oninput=renderUsers;$('#productSearch').oninput=renderProducts;document.addEventListener('launchboard:auth-ready',loadAdmin,{once:true});if(authReady)loadAdmin()});

async function loadReports(){
  const container=$('#adminReports');
  if(!container)return;
  const {data,error}=await sb.rpc('admin_list_reports');
  if(error){container.innerHTML=`<p class="muted">${esc(error.message)}</p>`;return}
  container.innerHTML=(data||[]).map(report=>`
    <div class="review row between">
      <div>
        <strong>${esc(report.reason)} · ${esc(report.target_type)}</strong>
        <p>${esc(report.details)}</p>
        <span class="muted">${esc(report.reporter_email||'Unknown reporter')} · ${new Date(report.created_at).toLocaleString()}</span>
      </div>
      <button class="btn btn-ghost" data-resolve-report="${report.id}" type="button">Resolve</button>
    </div>`).join('')||'<p class="muted">No open reports.</p>';
  $$('[data-resolve-report]').forEach(button=>button.onclick=async()=>{
    const {error}=await sb.rpc('admin_resolve_report',{target_report:button.dataset.resolveReport});
    if(error)return toast(error.message);
    toast('Report resolved.','success');
    loadReports();
  });
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(loadReports,500));
