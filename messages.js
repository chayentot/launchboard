let active=new URLSearchParams(location.search).get('conversation');
let conversations=[];
let memberProfiles={};
let creatorDirectory=[];
let followedCreatorIds=new Set();
let creatorMode='following';

async function loadConversations(){
  if(!currentUser){
    location.href='index.html';
    return;
  }

  try{
    const {data:membershipRows,error:membershipError}=await sb
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id',currentUser.id);

    if(membershipError)throw membershipError;

    const conversationIds=[...new Set((membershipRows||[]).map(row=>row.conversation_id).filter(Boolean))];

    if(!conversationIds.length){
      conversations=[];
      renderConversationList();
      renderEmptyChat();
      return;
    }

    const [
      {data:conversationRows,error:conversationError},
      {data:allMembers,error:membersError}
    ]=await Promise.all([
      sb.from('conversations')
        .select('id,product_id,updated_at')
        .in('id',conversationIds)
        .order('updated_at',{ascending:false}),
      sb.from('conversation_members')
        .select('conversation_id,user_id')
        .in('conversation_id',conversationIds)
    ]);

    if(conversationError)throw conversationError;
    if(membersError)throw membersError;

    const productIds=[...new Set((conversationRows||[]).map(row=>row.product_id).filter(Boolean))];
    const otherUserIds=[...new Set((allMembers||[])
      .map(row=>row.user_id)
      .filter(userId=>userId&&userId!==currentUser.id))];

    const [
      {data:productRows,error:productsError},
      {data:profileRows,error:profilesError}
    ]=await Promise.all([
      productIds.length
        ? sb.from('products').select('id,title').in('id',productIds)
        : Promise.resolve({data:[],error:null}),
      otherUserIds.length
        ? sb.from('profiles').select('id,full_name,username,avatar_url,is_verified').in('id',otherUserIds)
        : Promise.resolve({data:[],error:null})
    ]);

    if(productsError)throw productsError;
    if(profilesError)throw profilesError;

    const productsById=Object.fromEntries((productRows||[]).map(row=>[row.id,row]));
    memberProfiles=Object.fromEntries((profileRows||[]).map(row=>[row.id,row]));

    conversations=(conversationRows||[]).map(conversation=>{
      const members=(allMembers||[]).filter(row=>row.conversation_id===conversation.id);
      const otherMember=members.find(row=>row.user_id!==currentUser.id);
      return {
        ...conversation,
        members,
        otherProfile:otherMember?memberProfiles[otherMember.user_id]||{}:{},
        product:productsById[conversation.product_id]||null
      };
    });

    if(active&&!conversations.some(conversation=>conversation.id===active)){
      active=null;
      history.replaceState(null,'','messages.html');
    }

    renderConversationList();

    if(active)await loadMessages();
    else renderEmptyChat();
  }catch(error){
    console.error('Unable to load conversations:',error);
    toast(formatMessageError(error));
    renderConversationList();
    renderEmptyChat();
  }
}

function formatMessageError(error){
  const message=String(error?.message||error||'Unable to load messages.');
  if(message.includes('infinite recursion')){
    return 'Messaging permissions need the included Supabase policy update.';
  }
  return message;
}

function filteredConversations(){
  const query=($('#conversationSearch')?.value||'').trim().toLowerCase();
  if(!query)return conversations;
  return conversations.filter(conversation=>{
    const profile=conversation.otherProfile||{};
    return [
      profile.full_name,
      profile.username,
      conversation.product?.title
    ].some(value=>String(value||'').toLowerCase().includes(query));
  });
}

function renderConversationList(){
  const list=$('#conversationList');
  if(!list)return;

  const rows=filteredConversations();

  if(!rows.length){
    list.innerHTML=conversations.length
      ? '<div class="messages-empty-list compact"><strong>No matches</strong><p>Try another creator or product name.</p></div>'
      : '<div class="messages-empty-list"><strong>No conversations yet</strong><p>Tap New to search creators or message someone you follow.</p></div>';
    return;
  }

  list.innerHTML=rows.map(conversation=>{
    const profile=conversation.otherProfile||{};
    const name=profile.full_name||profile.username||'Member';
    const avatar=profile.avatar_url
      ? `<img src="${esc(safeUrl(profile.avatar_url,''))}" alt="">`
      : `<span>${esc(name.slice(0,1).toUpperCase())}</span>`;

    return `<button class="conversation ${conversation.id===active?'active':''}" data-id="${conversation.id}" type="button">
      <span class="conversation-avatar">${avatar}</span>
      <span class="conversation-copy">
        <strong>${esc(name)} ${badge(profile)}</strong>
        <small>${esc(conversation.product?.title||'Direct conversation')}</small>
      </span>
    </button>`;
  }).join('');

  $$('[data-id]').forEach(button=>{
    button.onclick=async()=>{
      active=button.dataset.id;
      history.replaceState(null,'',`messages.html?conversation=${encodeURIComponent(active)}`);
      renderConversationList();
      await loadMessages();
    };
  });
}

function renderEmptyChat(){
  const title=$('#chatTitle');
  const messages=$('#messages');
  if(title)title.innerHTML='<div><h2>Select a conversation</h2><p class="muted">Choose someone from your message list.</p></div>';
  if(messages)messages.innerHTML='<div class="chat-empty-state"><span>✉</span><strong>Your messages will appear here</strong><p>Select a conversation or tap New.</p></div>';
}

async function loadMessages(){
  const conversation=conversations.find(item=>item.id===active);
  if(!conversation){
    renderEmptyChat();
    return;
  }

  const profile=conversation.otherProfile||{};
  const name=profile.full_name||profile.username||'Conversation';

  $('#chatTitle').innerHTML=`<div>
    <h2>${esc(name)}</h2>
    <p class="muted">${esc(conversation.product?.title||'Direct message')}</p>
  </div>`;

  const {data,error}=await sb.from('messages')
    .select('id,conversation_id,sender_id,body,created_at')
    .eq('conversation_id',active)
    .order('created_at',{ascending:true});

  if(error){
    toast(formatMessageError(error));
    return;
  }

  const container=$('#messages');
  container.innerHTML=(data||[]).map(message=>`
    <div class="bubble ${message.sender_id===currentUser.id?'mine':''}">
      ${esc(message.body)}
    </div>`).join('')
    ||'<div class="chat-empty-state"><span>✉</span><strong>No messages yet</strong><p>Send the first message below.</p></div>';

  container.scrollTop=container.scrollHeight;
}

async function send(event){
  event.preventDefault();
  if(!active)return toast('Select a conversation first.');

  const form=event.target;
  const data=new FormData(form);
  const body=String(data.get('body')||'').trim();
  if(!body)return;

  const button=form.querySelector('button');
  button.disabled=true;

  try{
    const {error}=await sb.from('messages').insert({
      conversation_id:active,
      sender_id:currentUser.id,
      body
    });
    if(error)throw error;
    form.reset();
    await loadMessages();
  }catch(error){
    toast(formatMessageError(error));
  }finally{
    button.disabled=false;
  }
}

async function loadCreatorDirectory(){
  const [
    {data:profiles,error:profilesError},
    {data:follows,error:followsError}
  ]=await Promise.all([
    sb.from('profiles')
      .select('id,full_name,username,avatar_url,is_verified,bio')
      .neq('id',currentUser.id)
      .order('full_name',{ascending:true}),
    sb.from('creator_follows')
      .select('creator_id')
      .eq('follower_id',currentUser.id)
  ]);

  if(profilesError)throw profilesError;
  if(followsError)throw followsError;

  creatorDirectory=profiles||[];
  followedCreatorIds=new Set((follows||[]).map(row=>row.creator_id));
  renderCreatorDirectory();
}

function visibleCreators(){
  const query=($('#creatorSearchInput')?.value||'').trim().toLowerCase();
  return creatorDirectory.filter(profile=>{
    const inMode=creatorMode==='all'||followedCreatorIds.has(profile.id);
    const matches=!query||[
      profile.full_name,
      profile.username,
      profile.bio
    ].some(value=>String(value||'').toLowerCase().includes(query));
    return inMode&&matches;
  });
}

function renderCreatorDirectory(){
  const target=$('#creatorMessageResults');
  if(!target)return;

  const rows=visibleCreators();
  target.innerHTML=rows.map(profile=>{
    const name=profile.full_name||profile.username||'Creator';
    const avatar=profile.avatar_url
      ? `<img src="${esc(safeUrl(profile.avatar_url,''))}" alt="">`
      : `<span>${esc(name.slice(0,1).toUpperCase())}</span>`;

    return `<article class="creator-message-row">
      <span class="conversation-avatar">${avatar}</span>
      <span class="creator-message-copy">
        <strong>${esc(name)} ${badge(profile)}</strong>
        <small>${esc(profile.bio||'Independent creator')}</small>
      </span>
      <button class="btn btn-primary" data-message-creator="${profile.id}" type="button">Message</button>
    </article>`;
  }).join('')||`<div class="messages-empty-list compact">
    <strong>${creatorMode==='following'?'You are not following any matching creators':'No creators found'}</strong>
    <p>${creatorMode==='following'?'Use All creators to find someone new.':'Try another name.'}</p>
  </div>`;

  $$('[data-message-creator]').forEach(button=>{
    button.onclick=()=>startCreatorConversation(button.dataset.messageCreator);
  });
}

async function startCreatorConversation(creatorId){
  try{
    const {data,error}=await sb.rpc('start_conversation',{
      target_user:creatorId,
      target_product:null
    });
    if(error)throw error;

    active=data;
    $('#creatorMessageModal')?.close?.();
    history.replaceState(null,'',`messages.html?conversation=${encodeURIComponent(active)}`);
    await loadConversations();
  }catch(error){
    toast(formatMessageError(error));
  }
}

async function openCreatorSearch(){
  $('#creatorMessageModal')?.showModal?.();
  try{
    await loadCreatorDirectory();
  }catch(error){
    toast(error.message||'Unable to load creators.');
  }
}

function setCreatorMode(mode){
  creatorMode=mode;
  $('#followingCreatorsTab')?.classList.toggle('active',mode==='following');
  $('#allCreatorsTab')?.classList.toggle('active',mode==='all');
  renderCreatorDirectory();
}

window.addEventListener('DOMContentLoaded',()=>{
  $('#messageForm').onsubmit=send;
  $('#conversationSearch')?.addEventListener('input',renderConversationList);
  $('#openCreatorSearch')?.addEventListener('click',openCreatorSearch);
  $('#closeCreatorSearch')?.addEventListener('click',()=>$('#creatorMessageModal')?.close?.());
  $('#creatorSearchInput')?.addEventListener('input',renderCreatorDirectory);
  $('#followingCreatorsTab')?.addEventListener('click',()=>setCreatorMode('following'));
  $('#allCreatorsTab')?.addEventListener('click',()=>setCreatorMode('all'));

  document.addEventListener('launchboard:auth-ready',loadConversations,{once:true});
  if(authReady)loadConversations();
});
