let notificationRows=[];
let notificationMode='all';

function notificationIcon(item){
  const title=String(item.title||'').toLowerCase();
  const body=String(item.body||'').toLowerCase();
  const text=`${title} ${body}`;

  if(text.includes('message'))return '✉';
  if(text.includes('like'))return '♥';
  if(text.includes('follow'))return '◎';
  if(text.includes('review'))return '★';
  if(text.includes('product'))return '▣';
  return '♢';
}

function notificationTime(value){
  if(!value)return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '';

  const difference=Date.now()-date.getTime();
  const minute=60*1000;
  const hour=60*minute;
  const day=24*hour;

  if(difference<minute)return 'Now';
  if(difference<hour)return `${Math.floor(difference/minute)}m`;
  if(difference<day)return `${Math.floor(difference/hour)}h`;
  if(difference<7*day)return `${Math.floor(difference/day)}d`;

  return date.toLocaleDateString([],{
    month:'short',
    day:'numeric'
  });
}

function notificationCategory(item){
  const text=`${item.title||''} ${item.body||''}`.toLowerCase();
  if(text.includes('message'))return 'message';
  if(text.includes('like')||text.includes('follow')||text.includes('review'))return 'social';
  return 'product';
}

function visibleNotifications(){
  if(notificationMode==='unread')return notificationRows.filter(item=>!item.is_read);
  if(notificationMode==='all')return notificationRows;
  return notificationRows.filter(item=>notificationCategory(item)===notificationMode);
}

function renderNotificationTabs(){
  $$('[data-notification-filter]').forEach(button=>{
    button.classList.toggle('active',button.dataset.notificationFilter===notificationMode);
  });

  const unread=notificationRows.filter(item=>!item.is_read).length;
  const count=$('#notificationUnreadCount');
  if(count)count.textContent=String(unread);
}

function renderNotifications(){
  const target=$('#notificationsList');
  if(!target)return;

  renderNotificationTabs();

  const rows=visibleNotifications();

  if(!rows.length){
    target.innerHTML=`<div class="notifications-empty">
      <span>♢</span>
      <strong>${notificationMode==='unread'?'You are all caught up':'No notifications yet'}</strong>
      <p>${notificationMode==='unread'
        ? 'New activity will appear here.'
        : 'Likes, followers, reviews, messages, and product activity will appear here.'}</p>
    </div>`;
    return;
  }

  target.innerHTML=rows.map(item=>`
    <button class="notification-row ${item.is_read?'':'unread'}" data-notification-id="${item.id}" type="button">
      <span class="notification-icon">${notificationIcon(item)}</span>
      <span class="notification-copy">
        <strong>${esc(item.title||'LaunchBoard notification')}</strong>
        <p>${esc(item.body||'')}</p>
      </span>
      <span class="notification-meta">
        <time>${notificationTime(item.created_at)}</time>
        ${item.is_read?'':'<span class="notification-unread-dot"></span>'}
      </span>
    </button>`).join('');

  $$('[data-notification-id]').forEach(button=>{
    button.addEventListener('click',()=>openNotification(button.dataset.notificationId));
  });
}

async function loadNotifications(){
  if(!currentUser){
    location.href='index.html';
    return;
  }

  const {data,error}=await sb
    .from('notifications')
    .select('id,title,body,link,is_read,created_at')
    .eq('user_id',currentUser.id)
    .order('created_at',{ascending:false})
    .limit(100);

  if(error){
    console.error('Notifications failed:',error);
    toast(error.message||'Unable to load notifications.');
    notificationRows=[];
  }else{
    notificationRows=data||[];
  }

  renderNotifications();
}

async function openNotification(id){
  const item=notificationRows.find(row=>String(row.id)===String(id));
  if(!item)return;

  if(!item.is_read){
    const {error}=await sb
      .from('notifications')
      .update({is_read:true})
      .eq('id',item.id)
      .eq('user_id',currentUser.id);

    if(!error){
      item.is_read=true;
      document.dispatchEvent(new CustomEvent('launchboard:notifications-changed'));
    }
  }

  const destination=safeUrl(item.link,'');
  if(destination&&destination!=='#'){
    location.href=destination;
  }else{
    renderNotifications();
  }
}

async function markAllRead(){
  const unread=notificationRows.filter(item=>!item.is_read);
  if(!unread.length){
    toast('You are already caught up.','success');
    return;
  }

  const button=$('#markAllNotificationsRead');
  button.disabled=true;

  const {error}=await sb
    .from('notifications')
    .update({is_read:true})
    .eq('user_id',currentUser.id)
    .eq('is_read',false);

  button.disabled=false;

  if(error)return toast(error.message);

  notificationRows.forEach(item=>item.is_read=true);
  renderNotifications();
  document.dispatchEvent(new CustomEvent('launchboard:notifications-changed'));
  toast('All notifications marked as read.','success');
}

window.addEventListener('DOMContentLoaded',()=>{
  $$('[data-notification-filter]').forEach(button=>{
    button.addEventListener('click',()=>{
      notificationMode=button.dataset.notificationFilter;
      renderNotifications();
    });
  });

  $('#markAllNotificationsRead')?.addEventListener('click',markAllRead);

  document.addEventListener('launchboard:auth-ready',loadNotifications,{once:true});
  if(authReady)loadNotifications();
});
