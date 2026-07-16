const config = window.LAUNCHBOARD_CONFIG || {};
const isConfigured = config.supabaseUrl?.startsWith('https://') && !config.supabaseUrl.includes('YOUR_') && config.supabaseKey && !config.supabaseKey.includes('YOUR_');
const db = isConfigured ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey) : null;

let products = [];
let currentUser = null;
let currentProfile = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const grid = $('#productGrid');
const toast = $('#toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
function setBusy(form, busy, label = 'Please wait…') {
  const button = form.querySelector('[type="submit"]');
  if (!button) return;
  if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.originalText;
}
function initials(name = 'User') { return name.split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase(); }
function escapeHTML(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function safeURL(value) { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } }
function profileName() { return currentProfile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Creator'; }

function bindModalButtons() {
  $$('[data-open]').forEach(btn => btn.onclick = () => $('#' + btn.dataset.open).showModal());
  $$('[data-close]').forEach(btn => btn.onclick = () => $('#' + btn.dataset.close).close());
  $$('[data-switch]').forEach(btn => btn.onclick = () => {
    btn.closest('dialog').close();
    $('#' + btn.dataset.switch).showModal();
  });
}

function renderHeader() {
  const holder = $('#headerActions');
  if (currentUser) {
    const name = profileName();
    holder.innerHTML = `<div class="user-menu"><button class="btn btn-primary" id="headerSubmitBtn">+ Submit</button><button class="user-chip" id="profileBtn"><span class="user-avatar">${initials(name)}</span>${escapeHTML(name.split(' ')[0])}</button></div>`;
    $('#headerSubmitBtn').onclick = openProductModal;
    $('#profileBtn').onclick = openProfile;
  } else {
    holder.innerHTML = `<button class="btn btn-ghost" data-open="loginModal">Log in</button><button class="btn btn-primary" data-open="signupModal">Join free</button>`;
    bindModalButtons();
  }
}

function productCard(p) {
  const image = p.image_url
    ? `<img src="${escapeHTML(p.image_url)}" alt="${escapeHTML(p.title)}" loading="lazy" onerror="this.remove();this.parentElement.querySelector('.product-placeholder').style.display='block'"/><span class="product-placeholder" style="display:none">✦</span>`
    : `<span class="product-placeholder">✦</span>`;
  return `<article class="product-card">
    <div class="product-image">${image}<span class="product-price">${escapeHTML(p.price || 'View price')}</span></div>
    <div class="product-body">
      <div class="product-meta"><span>${escapeHTML(p.category)}</span><span>by ${escapeHTML(p.creator)}</span></div>
      <h3>${escapeHTML(p.title)}</h3><p>${escapeHTML(p.description)}</p>
      <div class="tag-row">${(p.tags || []).slice(0, 3).map(t => `<span class="tag">#${escapeHTML(t)}</span>`).join('')}</div>
      <div class="product-actions"><a class="btn btn-primary visit-product" data-id="${p.id}" href="${safeURL(p.product_url)}" target="_blank" rel="noopener noreferrer">View product ↗</a><span class="click-count">${p.clicks || 0} clicks</span></div>
    </div></article>`;
}

function renderProducts() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const cat = $('#categoryFilter').value;
  const sort = $('#sortFilter').value;
  let list = products.filter(p => (cat === 'all' || p.category === cat) && [p.title, p.creator, p.description, (p.tags || []).join(' ')].join(' ').toLowerCase().includes(q));
  list.sort((a, b) => sort === 'popular' ? (b.clicks || 0) - (a.clicks || 0) : sort === 'az' ? a.title.localeCompare(b.title) : new Date(b.created_at) - new Date(a.created_at));
  grid.innerHTML = list.map(productCard).join('');
  $('#emptyState').classList.toggle('hidden', list.length > 0);
  $('#productCount').textContent = products.length;
  $$('.visit-product').forEach(link => link.addEventListener('click', async () => {
    const product = products.find(x => x.id === link.dataset.id);
    if (!product || !db) return;
    product.clicks = (product.clicks || 0) + 1;
    renderProducts();
    const { error } = await db.rpc('increment_product_clicks', { product_id: product.id });
    if (error) console.warn('Click tracking failed:', error.message);
  }));
}

async function loadProducts() {
  if (!db) { products = []; renderProducts(); return; }
  grid.innerHTML = '<p class="loading-copy">Loading products…</p>';
  const { data, error } = await db.from('products').select('*').eq('is_published', true).order('created_at', { ascending: false });
  if (error) { showToast(`Could not load products: ${error.message}`); products = []; }
  else products = data || [];
  renderProducts();
}

async function loadProfile() {
  if (!db || !currentUser) { currentProfile = null; return; }
  const { data } = await db.from('profiles').select('full_name').eq('id', currentUser.id).maybeSingle();
  currentProfile = data || null;
}

function openProductModal() {
  if (!isConfigured) { showToast('Configure Supabase in config.js first.'); return; }
  if (!currentUser) { $('#signupModal').showModal(); showToast('Create an account before submitting a product.'); return; }
  $('#productForm').reset();
  $('#descriptionCount').textContent = '0';
  $('#productModal').showModal();
}

function openProfile() {
  const mine = products.filter(p => p.owner_id === currentUser.id);
  $('#profileName').textContent = profileName();
  $('#profileEmail').textContent = currentUser.email;
  $('#profileProducts').textContent = mine.length;
  $('#profileClicks').textContent = mine.reduce((sum, p) => sum + (p.clicks || 0), 0);
  $('#profileModal').showModal();
}

async function uploadImage(file) {
  if (!file || file.size === 0) return '';
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from('product-images').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  return db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

$('#signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!db) return showToast('Configure Supabase in config.js first.');
  const form = e.currentTarget;
  const fd = new FormData(form);
  setBusy(form, true, 'Creating account…');
  const { data, error } = await db.auth.signUp({
    email: String(fd.get('email')).trim().toLowerCase(),
    password: String(fd.get('password')),
    options: { data: { full_name: String(fd.get('name')).trim() } }
  });
  setBusy(form, false);
  if (error) return showToast(error.message);
  form.closest('dialog').close();
  form.reset();
  if (data.session) showToast('Account created. You are now logged in!');
  else showToast('Account created. Check your email to confirm your address.');
});

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!db) return showToast('Configure Supabase in config.js first.');
  const form = e.currentTarget;
  const fd = new FormData(form);
  setBusy(form, true, 'Logging in…');
  const { error } = await db.auth.signInWithPassword({ email: String(fd.get('email')).trim().toLowerCase(), password: String(fd.get('password')) });
  setBusy(form, false);
  if (error) return showToast(error.message);
  form.closest('dialog').close();
  form.reset();
  showToast('Welcome back!');
});

$('#productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!db || !currentUser) return showToast('Please log in first.');
  const form = e.currentTarget;
  const fd = new FormData(form);
  setBusy(form, true, 'Publishing…');
  try {
    const file = fd.get('imageFile');
    const uploadedUrl = file instanceof File ? await uploadImage(file) : '';
    const imageUrl = uploadedUrl || String(fd.get('image') || '').trim() || null;
    const item = {
      owner_id: currentUser.id,
      title: String(fd.get('title')).trim(),
      creator: String(fd.get('creator')).trim(),
      category: String(fd.get('category')),
      price: String(fd.get('price')).trim() || 'View price',
      image_url: imageUrl,
      product_url: String(fd.get('url')).trim(),
      description: String(fd.get('description')).trim(),
      tags: String(fd.get('tags')).split(',').map(x => x.trim().toLowerCase()).filter(Boolean).slice(0, 8)
    };
    const { error } = await db.from('products').insert(item);
    if (error) throw error;
    form.closest('dialog').close();
    form.reset();
    await loadProducts();
    showToast('Your product is now live!');
    $('#discover').scrollIntoView({ behavior: 'smooth' });
  } catch (error) { showToast(error.message || 'Could not publish the product.'); }
  finally { setBusy(form, false); }
});

$('#descriptionCount').closest('label').querySelector('textarea').addEventListener('input', e => $('#descriptionCount').textContent = e.target.value.length);
$('#searchInput').addEventListener('input', renderProducts);
$('#categoryFilter').addEventListener('change', renderProducts);
$('#sortFilter').addEventListener('change', renderProducts);
$$('[data-category]').forEach(btn => btn.onclick = () => { $('#categoryFilter').value = btn.dataset.category; renderProducts(); $('#discover').scrollIntoView({ behavior: 'smooth' }); });
['heroSubmitBtn', 'sectionSubmitBtn', 'ctaSubmitBtn'].forEach(id => $('#' + id).onclick = openProductModal);
$('#profileAddProduct').onclick = () => { $('#profileModal').close(); openProductModal(); };
$('#logoutBtn').onclick = async () => { await db?.auth.signOut(); $('#profileModal').close(); showToast('You have been logged out.'); };
document.querySelectorAll('dialog').forEach(d => {
  d.addEventListener('click', e => {
    if (e.target === d) {
      d.close();
    }
  });
});

async function initialize() {
  $('#year').textContent = new Date().getFullYear();
  bindModalButtons();
  if (!isConfigured) $('#setupBanner').classList.remove('hidden');
  if (db) {
    const { data } = await db.auth.getSession();
    currentUser = data.session?.user || null;
    await loadProfile();
    db.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        currentUser = session?.user || null;
        await loadProfile();
        renderHeader();
        renderProducts();
      }, 0);
    });
  }
  renderHeader();
  await loadProducts();
}
initialize();
