const STORAGE = { users: 'launchboard_users', current: 'launchboard_current_user', products: 'launchboard_products' };
const defaultProducts = [
  {id:crypto.randomUUID(),title:'Focus Flow Notion System',creator:'Ana Kim Studio',category:'Productivity',price:'$19',image:'',url:'https://www.notion.so/templates',description:'A calm, practical workspace for planning projects, habits, and weekly priorities.',tags:['notion','planner','focus'],clicks:1248,createdAt:Date.now()-100000},
  {id:crypto.randomUUID(),title:'Indie Launch Kit',creator:'Northstar Labs',category:'Business',price:'$29',image:'',url:'https://gumroad.com',description:'Templates and checklists to help solo founders plan, launch, and promote a new product.',tags:['startup','marketing','launch'],clicks:864,createdAt:Date.now()-200000},
  {id:crypto.randomUUID(),title:'Aurora UI Icon Pack',creator:'Mira Design Co.',category:'Design',price:'Free',image:'',url:'https://www.figma.com/community',description:'A clean collection of interface icons for modern web and mobile design projects.',tags:['icons','figma','ui'],clicks:632,createdAt:Date.now()-300000},
  {id:crypto.randomUUID(),title:'PromptCraft AI Toolkit',creator:'MakerHouse',category:'Technology',price:'$15',image:'',url:'https://gumroad.com',description:'Reusable prompt frameworks for research, content creation, and everyday AI workflows.',tags:['ai','prompts','toolkit'],clicks:511,createdAt:Date.now()-400000},
  {id:crypto.randomUUID(),title:'Freelance Finance Mini-Course',creator:'Clara Mendoza',category:'Education',price:'$39',image:'',url:'https://www.udemy.com',description:'Learn simple pricing, cash-flow, and tax habits for a healthier freelance business.',tags:['finance','course','freelance'],clicks:384,createdAt:Date.now()-500000},
  {id:crypto.randomUUID(),title:'Mindful Morning Journal',creator:'Slow Days Studio',category:'Lifestyle',price:'$9',image:'',url:'https://www.etsy.com',description:'A printable 30-day journal designed to make mornings more focused and intentional.',tags:['journal','wellness','printable'],clicks:277,createdAt:Date.now()-600000}
];

const getJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const saveJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
if (!localStorage.getItem(STORAGE.products)) saveJSON(STORAGE.products, defaultProducts);

let products = getJSON(STORAGE.products, defaultProducts);
let currentUser = getJSON(STORAGE.current, null);

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const grid = $('#productGrid');
const toast = $('#toast');

function showToast(message){ toast.textContent=message; toast.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>toast.classList.remove('show'),2600); }
function initials(name='User'){ return name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(); }
function escapeHTML(value=''){ return value.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function safeURL(value){ try { const u=new URL(value); return ['http:','https:'].includes(u.protocol)?u.href:'#'; } catch { return '#'; } }

function renderHeader(){
  const holder=$('#headerActions');
  if(currentUser){ holder.innerHTML=`<div class="user-menu"><button class="btn btn-primary" id="headerSubmitBtn">+ Submit</button><button class="user-chip" id="profileBtn"><span class="user-avatar">${initials(currentUser.name)}</span>${escapeHTML(currentUser.name.split(' ')[0])}</button></div>`; $('#headerSubmitBtn').onclick=openProductModal; $('#profileBtn').onclick=()=>openProfile(); }
  else { holder.innerHTML=`<button class="btn btn-ghost" data-open="loginModal">Log in</button><button class="btn btn-primary" data-open="signupModal">Join free</button>`; bindModalButtons(); }
}

function productCard(p){
  const image = p.image ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.title)}" onerror="this.remove();this.parentElement.querySelector('.product-placeholder').style.display='block'"/><span class="product-placeholder" style="display:none">✦</span>` : `<span class="product-placeholder">✦</span>`;
  return `<article class="product-card">
    <div class="product-image">${image}<span class="product-price">${escapeHTML(p.price||'View price')}</span></div>
    <div class="product-body">
      <div class="product-meta"><span>${escapeHTML(p.category)}</span><span>by ${escapeHTML(p.creator)}</span></div>
      <h3>${escapeHTML(p.title)}</h3><p>${escapeHTML(p.description)}</p>
      <div class="tag-row">${(p.tags||[]).slice(0,3).map(t=>`<span class="tag">#${escapeHTML(t)}</span>`).join('')}</div>
      <div class="product-actions"><a class="btn btn-primary visit-product" data-id="${p.id}" href="${safeURL(p.url)}" target="_blank" rel="noopener">View product ↗</a><span class="click-count">${p.clicks||0} clicks</span></div>
    </div></article>`;
}

function renderProducts(){
  const q=$('#searchInput').value.trim().toLowerCase(); const cat=$('#categoryFilter').value; const sort=$('#sortFilter').value;
  let list=products.filter(p=>(cat==='all'||p.category===cat)&&[p.title,p.creator,p.description,(p.tags||[]).join(' ')].join(' ').toLowerCase().includes(q));
  list.sort((a,b)=>sort==='popular'?(b.clicks||0)-(a.clicks||0):sort==='az'?a.title.localeCompare(b.title):(b.createdAt||0)-(a.createdAt||0));
  grid.innerHTML=list.map(productCard).join(''); $('#emptyState').classList.toggle('hidden',list.length>0); $('#productCount').textContent=products.length;
  $$('.visit-product').forEach(link=>link.addEventListener('click',()=>{ const p=products.find(x=>x.id===link.dataset.id); if(p){p.clicks=(p.clicks||0)+1;saveJSON(STORAGE.products,products);setTimeout(renderProducts,100);} }));
}

function bindModalButtons(){ $$('[data-open]').forEach(btn=>btn.onclick=()=>$('#'+btn.dataset.open).showModal()); $$('[data-close]').forEach(btn=>btn.onclick=()=>$('#'+btn.dataset.close).close()); $$('[data-switch]').forEach(btn=>btn.onclick=()=>{btn.closest('dialog').close();$('#'+btn.dataset.switch).showModal();}); }
function openProductModal(){ if(!currentUser){ $('#signupModal').showModal(); showToast('Create an account before submitting a product.'); return; } $('#productForm').reset(); $('#descriptionCount').textContent='0'; $('#productModal').showModal(); }
function openProfile(){ const mine=products.filter(p=>p.ownerEmail===currentUser.email); $('#profileName').textContent=currentUser.name; $('#profileEmail').textContent=currentUser.email; $('#profileProducts').textContent=mine.length; $('#profileClicks').textContent=mine.reduce((s,p)=>s+(p.clicks||0),0); $('#profileModal').showModal(); }

$('#signupForm').addEventListener('submit',e=>{ e.preventDefault(); const fd=new FormData(e.currentTarget); const users=getJSON(STORAGE.users,[]); const email=fd.get('email').trim().toLowerCase(); if(users.some(u=>u.email===email)){showToast('An account with that email already exists.');return;} const user={name:fd.get('name').trim(),email,password:fd.get('password')}; users.push(user);saveJSON(STORAGE.users,users); currentUser={name:user.name,email:user.email};saveJSON(STORAGE.current,currentUser);e.currentTarget.closest('dialog').close();renderHeader();showToast('Account created successfully!'); });
$('#loginForm').addEventListener('submit',e=>{ e.preventDefault(); const fd=new FormData(e.currentTarget); const users=getJSON(STORAGE.users,[]); const user=users.find(u=>u.email===fd.get('email').trim().toLowerCase()&&u.password===fd.get('password')); if(!user){showToast('Incorrect email or password.');return;} currentUser={name:user.name,email:user.email};saveJSON(STORAGE.current,currentUser);e.currentTarget.closest('dialog').close();renderHeader();showToast(`Welcome back, ${user.name.split(' ')[0]}!`); });
$('#productForm').addEventListener('submit',e=>{ e.preventDefault(); const fd=new FormData(e.currentTarget); const item={id:crypto.randomUUID(),title:fd.get('title').trim(),creator:fd.get('creator').trim(),category:fd.get('category'),price:fd.get('price').trim()||'View price',image:fd.get('image').trim(),url:fd.get('url').trim(),description:fd.get('description').trim(),tags:fd.get('tags').split(',').map(x=>x.trim()).filter(Boolean),clicks:0,createdAt:Date.now(),ownerEmail:currentUser.email}; products.unshift(item);saveJSON(STORAGE.products,products);e.currentTarget.closest('dialog').close();renderProducts();showToast('Your product is now live!');document.querySelector('#discover').scrollIntoView({behavior:'smooth'}); });

$('#descriptionCount').closest('label').querySelector('textarea').addEventListener('input',e=>$('#descriptionCount').textContent=e.target.value.length);
$('#searchInput').addEventListener('input',renderProducts); $('#categoryFilter').addEventListener('change',renderProducts); $('#sortFilter').addEventListener('change',renderProducts);
$$('[data-category]').forEach(btn=>btn.onclick=()=>{$('#categoryFilter').value=btn.dataset.category;renderProducts();$('#discover').scrollIntoView({behavior:'smooth'});});
['heroSubmitBtn','sectionSubmitBtn','ctaSubmitBtn'].forEach(id=>$('#'+id).onclick=openProductModal);
$('#profileAddProduct').onclick=()=>{$('#profileModal').close();openProductModal();};
$('#logoutBtn').onclick=()=>{localStorage.removeItem(STORAGE.current);currentUser=null;$('#profileModal').close();renderHeader();showToast('You have been logged out.');};

document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}));
$('#year').textContent=new Date().getFullYear(); bindModalButtons();renderHeader();renderProducts();
