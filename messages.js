let active=new URLSearchParams(location.search).get('conversation');
let conversations=[];
let memberProfiles={};

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
      sb
        .from('conversations')
        .select('id,product_id,updated_at')
        .in('id',conversationIds)
        .order('updated_at',{ascending:false}),
      sb
        .from('conversation_members')
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

    if(active){
      await loadMessages();
    }else{
      renderEmptyChat();
    }
  }catch(error){
    console.error('Unable to load conversations:',error);
    toast(error.message||'Unable to load messages.');
    renderConversationList();
    renderEmptyChat();
  }
}

function renderConversationList(){
  const list=$('#conversationList');
  if(!list)return;

  if(!conversations.length){
    list.innerHTML='<div class="messages-empty-list"><strong>No conversations yet</strong><p>Open a product and message its creator to start a conversation.</p></div>';
    return;
  }

  list.innerHTML=conversations.map(conversation=>{
    const profile=conversation.otherProfile||{};
    const name=profile.full_name||profile.username||'Member';
    const avatar=profile.avatar_url
      ? `<img src="${esc(safeUrl(profile.avatar_url,''))}" alt="">`
      : `<span>${esc(name.slice(0,1).toUpperCase())}</span>`;

    return `<button class="conversation ${conversation.id===active?'active':''}" data-id="${conversation.id}" type="button">
      <span class="conversation-avatar">${avatar}</span>
      <span class="conversation-copy">
        <strong>${esc(name)} ${badge(profile)}</strong>
        <small>${esc(conversation.product?.title||'General conversation')}</small>
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
  if(messages)messages.innerHTML='<div class="chat-empty-state"><span>✉</span><strong>Your messages will appear here</strong><p>Select a conversation to begin.</p></div>';
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

  const {data,error}=await sb
    .from('messages')
    .select('id,conversation_id,sender_id,body,created_at')
    .eq('conversation_id',active)
    .order('created_at',{ascending:true});

  if(error){
    toast(error.message);
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

  if(!active){
    toast('Select a conversation first.');
    return;
  }

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
    toast(error.message||'Message could not be sent.');
  }finally{
    button.disabled=false;
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  $('#messageForm').onsubmit=send;
  document.addEventListener('launchboard:auth-ready',loadConversations,{once:true});
  if(authReady)loadConversations();
});
