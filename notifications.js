let notificationRows=[];
let notificationMode='all';
let notificationProducts={};

function notificationIcon(item){
  const type=String(item.type||notificationCategory(item));
  if(type==='product'||type==='new_product')return '▣';
  if(['like','follow','review','social'].includes(type))return type==='like'?'♥':'◎';
  return '♢';
}
function notificationTime(value){
  if(!value)return '';
  const date=new Date(value); if(Number.isNaN(date.getTime()))return '';
  const diff=Date.now()-date.getTime(), minute=60000, hour=3600000, day=86400000;
  if(diff<minute)return 'Now'; if(diff<hour)return `${Math.floor(diff/minute)}m`;
  if(diff<day)return `${Math.floor(diff/hour)}h`; if(diff<7*day)return `${Math.floor(diff/day)}d`;
  return date.toLocaleDateString([],{month:'short',day:'numeric'});
}
function notificationCategory(item){
  const type=String(item.type||'').toLowerCase();
  const text=`${item.title||''} ${item.body||''}`.toLowerCase();
  if(type==='message'||text.includes('new message'))return 'message';
  if(['like','follow','review','social'].includes(type)||text.includes('liked')||text.includes('followed')||text.includes('review'))return 'social';
  if(['product','new_product','product_update'].includes(type)||text.includes('product')||text.includes('uploaded'))return 'product';
  return 'system';
}
function productIdFromLink(link=''){
  try{
    const url=new URL(link,location.href);
    return url.pathname.endsWith('product.html')?url.searchParams.get('id'):null;
  }catch{return null;}
}
function visibleNotifications(){
  const rows=notificationRows.filter(item=>notificationCategory(item)!=='message');
  if(notificationMode==='unread')return rows.filter(item=>!item.is_read);
  if(notificationMode==='all')return rows;
  return rows.filter(item=>notificationCategory(item)===notificationMode);
}
function renderNotificationTabs(){
  $$('[data-notification-filter]').forEach(button=>button.classList.toggle('active',button.dataset.notificationFilter===notificationMode));
  const unread=notificationRows.filter(item=>!item.is_read&&notificationCategory(item)!=='message').length;
  const count=$('#notificationUnreadCount'); if(count)count.textContent=String(unread);
}
function renderNotifications(){
  const target=$('#notificationsList'); if(!target)return;
  renderNotificationTabs(); const rows=visibleNotifications();
  if(!rows.length){
    target.innerHTML=`<div class="notifications-empty"><span>♢</span><strong>${notificationMode==='unread'?'You are all caught up':'No notifications yet'}</strong><p>${notificationMode==='unread'?'New activity will appear here.':'New products from creators you follow, likes, followers, and account updates will appear here.'}</p></div>`;
    return;
  }
  target.innerHTML=rows.map(item=>{
    const product=notificationProducts[productIdFromLink(item.link)]||null;
    const thumb=product?.image_url?`<img class="notification-product-thumb" src="${esc(safeUrl(product.image_url,''))}" alt="">`:'';
    return `<button class="notification-row ${item.is_read?'':'unread'}" data-notification-id="${item.id}" type="button">
      <span class="notification-icon">${notificationIcon(item)}</span>
      <span class="notification-copy"><strong>${esc(item.title||'LaunchBoard notification')}</strong><p>${esc(item.body||'')}</p>${product?`<span class="notification-product-link">View product →</span>`:''}</span>
      ${thumb}<span class="notification-meta"><time>${notificationTime(item.created_at)}</time>${item.is_read?'':'<span class="notification-unread-dot"></span>'}</span>
    </button>`;
  }).join('');
  $$('[data-notification-id]').forEach(button=>button.addEventListener('click',()=>openNotification(button.dataset.notificationId)));
}
async function loadNotifications(){
  if(!currentUser){location.href='index.html';return;}
  let response=await sb.from('notifications').select('id,type,title,body,link,is_read,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(100);
  if(response.error&&String(response.error.message).includes('type'))response=await sb.from('notifications').select('id,title,body,link,is_read,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(100);
  if(response.error){console.error(response.error);toast(response.error.message||'Unable to load notifications.');notificationRows=[];}
  else notificationRows=response.data||[];
  const productIds=[...new Set(notificationRows.map(x=>productIdFromLink(x.link)).filter(Boolean))];
  if(productIds.length){
    const {data}=await sb.from('products').select('id,title,image_url,price').in('id',productIds);
    notificationProducts=Object.fromEntries((data||[]).map(x=>[x.id,x]));
  }
  renderNotifications();
}
async function openNotification(id){
  const item=notificationRows.find(row=>String(row.id)===String(id)); if(!item)return;
  if(!item.is_read){
    const {error}=await sb.from('notifications').update({is_read:true}).eq('id',item.id).eq('user_id',currentUser.id);
    if(!error){item.is_read=true;document.dispatchEvent(new CustomEvent('launchboard:notifications-changed'));}
  }
  const destination=safeUrl(item.link,'');
  if(destination&&destination!=='#')location.href=destination; else renderNotifications();
}
async function markAllRead(){
  const unread=notificationRows.filter(item=>!item.is_read&&notificationCategory(item)!=='message');
  if(!unread.length)return toast('You are already caught up.','success');
  const button=$('#markAllNotificationsRead');button.disabled=true;
  const {error}=await sb.from('notifications').update({is_read:true}).eq('user_id',currentUser.id).eq('is_read',false).neq('type','message');
  button.disabled=false;if(error)return toast(error.message);
  notificationRows.forEach(item=>{if(notificationCategory(item)!=='message')item.is_read=true;});
  renderNotifications();document.dispatchEvent(new CustomEvent('launchboard:notifications-changed'));toast('All notifications marked as read.','success');
}
window.addEventListener('DOMContentLoaded',()=>{
  $$('[data-notification-filter]').forEach(button=>button.addEventListener('click',()=>{notificationMode=button.dataset.notificationFilter;renderNotifications();}));
  $('#markAllNotificationsRead')?.addEventListener('click',markAllRead);
  document.addEventListener('launchboard:auth-ready',loadNotifications,{once:true});if(authReady)loadNotifications();
});
