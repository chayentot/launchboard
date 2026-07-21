let active=new URLSearchParams(location.search).get('conversation');
let conversations=[];
let memberProfiles={};
let creatorDirectory=[];
let followedCreatorIds=new Set();
let creatorMode='following';
let pendingAttachment=null;
const MESSAGE_ATTACHMENTS_BUCKET='message-attachments';
const MAX_MESSAGE_ATTACHMENT_BYTES=15*1024*1024;
const READ_KEY_PREFIX='launchboard:conversation-read:';

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
      {data:profileRows,error:profilesError},
      {data:messageRows,error:messagesError}
    ]=await Promise.all([
      productIds.length
        ? sb.from('products').select('id,title,price,image_url,creator,owner_id').in('id',productIds)
        : Promise.resolve({data:[],error:null}),
      otherUserIds.length
        ? sb.from('profiles').select('id,full_name,username,avatar_url,is_verified').in('id',otherUserIds)
        : Promise.resolve({data:[],error:null}),
      conversationIds.length
        ? sb.from('messages')
            .select('id,conversation_id,sender_id,body,attachment_url,attachment_name,attachment_type,attachment_size,created_at')
            .in('conversation_id',conversationIds)
            .order('created_at',{ascending:false})
        : Promise.resolve({data:[],error:null})
    ]);

    if(productsError)throw productsError;
    if(profilesError)throw profilesError;
    if(messagesError)throw messagesError;

    const productsById=Object.fromEntries((productRows||[]).map(row=>[row.id,row]));
    memberProfiles=Object.fromEntries((profileRows||[]).map(row=>[row.id,row]));

    const latestByConversation={};
    (messageRows||[]).forEach(message=>{
      if(!latestByConversation[message.conversation_id]){
        latestByConversation[message.conversation_id]=message;
      }
    });

    conversations=(conversationRows||[]).map(conversation=>{
      const members=(allMembers||[]).filter(row=>row.conversation_id===conversation.id);
      const otherMember=members.find(row=>row.user_id!==currentUser.id);
      const latestMessage=latestByConversation[conversation.id]||null;
      const lastReadAt=Number(localStorage.getItem(READ_KEY_PREFIX+conversation.id)||0);
      const unread=Boolean(
        latestMessage
        && latestMessage.sender_id!==currentUser.id
        && new Date(latestMessage.created_at).getTime()>lastReadAt
      );

      return {
        ...conversation,
        members,
        latestMessage,
        unread,
        otherProfile:otherMember?memberProfiles[otherMember.user_id]||{}:{},
        product:productsById[conversation.product_id]||null
      };
    }).sort((a,b)=>{
      const aTime=new Date(a.latestMessage?.created_at||a.updated_at||0).getTime();
      const bTime=new Date(b.latestMessage?.created_at||b.updated_at||0).getTime();
      return bTime-aTime;
    });

    if(active&&!conversations.some(conversation=>conversation.id===active)){
      active=null;
      history.replaceState(null,'','messages.html');
    }

    renderConversationList();

    if(active){
      await loadMessages();
      openMobileChat();
      requestAnimationFrame(()=>$('#messageForm input[name="body"]')?.focus());
    }else{
      renderEmptyChat();
    }
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


function formatConversationTime(value){
  if(!value)return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  const now=new Date();
  const sameDay=date.toDateString()===now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})
    : date.toLocaleDateString([], {month:'short',day:'numeric'});
}



function renderFollowingStrip(){
  const target=$('#followingCreatorStrip');
  if(!target)return;

  const followed=creatorDirectory
    .filter(profile=>followedCreatorIds.has(profile.id))
    .slice(0,8);

  target.innerHTML=followed.map(profile=>{
    const name=profile.full_name||profile.username||'Creator';
    const avatar=profile.avatar_url
      ? `<img src="${esc(safeUrl(profile.avatar_url,''))}" alt="">`
      : `<span>${esc(name.slice(0,1).toUpperCase())}</span>`;

    return `<button class="messenger-following-person" data-following-message="${profile.id}" type="button">
      <span class="messenger-story-ring">
        <span class="messenger-avatar">${avatar}</span>
      </span>
      <small>${esc(name)}</small>
    </button>`;
  }).join('')||'<p class="messenger-following-empty">Follow creators to see them here.</p>';

  $$('[data-following-message]').forEach(button=>{
    button.onclick=()=>startCreatorConversation(button.dataset.followingMessage);
  });
}

function openMobileChat(){
  document.body.classList.add('messenger-chat-open');
}

function closeMobileChat(){
  document.body.classList.remove('messenger-chat-open');
}

window.LaunchBoardMessages={
  isChatOpen:()=>document.body.classList.contains('messenger-chat-open'),
  closeChat:closeMobileChat
};

function filteredConversations(){
  const query=($('#conversationSearch')?.value||'').trim().toLowerCase();
  if(!query)return conversations;
  return conversations.filter(conversation=>{
    const profile=conversation.otherProfile||{};
    return [
      profile.full_name,
      profile.username,
      conversation.product?.title,
      conversation.latestMessage?.body
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

    return `<button class="messenger-conversation ${conversation.id===active?'active':''}" data-id="${conversation.id}" type="button">
      <span class="messenger-story-ring compact">
        <span class="messenger-avatar">${avatar}</span>
      </span>
      <span class="messenger-conversation-main">
        <span class="messenger-conversation-topline">
          <strong>${esc(name)} ${badge(profile)}</strong>
          <time>${formatConversationTime(conversation.latestMessage?.created_at||conversation.updated_at)}</time>
        </span>
        <small class="${conversation.unread?'unread':''}">${esc(
          conversation.latestMessage
            ? `${conversation.latestMessage.sender_id===currentUser.id?'You: ':''}${conversation.latestMessage.body}`
            : (conversation.product?.title||'Tap to open conversation')
        )}</small>
      </span>
      ${conversation.unread?'<span class="messenger-unread-dot" aria-label="Unread message"></span>':''}
    </button>`;
  }).join('');

  $$('[data-id]').forEach(button=>{
    button.onclick=async()=>{
      active=button.dataset.id;
      history.replaceState(null,'',`messages.html?conversation=${encodeURIComponent(active)}`);
      renderConversationList();
      await loadMessages();
      openMobileChat();
    };
  });
}

function renderEmptyChat(){
  const title=$('#chatTitle');
  const messages=$('#messages');
  if(title)title.innerHTML='<div><h2>Select a conversation</h2><p>Choose someone from your messages.</p></div>';
  if(messages)messages.innerHTML='<div class="messenger-empty"><span>✉</span><strong>Your messages will appear here</strong><p>Select a conversation or tap +.</p></div>';
}


function renderProductReference(product){
  const image=product.image_url
    ? `<img src="${esc(safeUrl(product.image_url,''))}" alt="${esc(product.title||'Product')}">`
    : '<span class="messenger-product-reference-placeholder">No image</span>';

  return `<article class="messenger-product-reference" aria-label="Product being discussed">
    <span class="messenger-product-reference-label">Talking about</span>
    <a class="messenger-product-reference-card" href="product.html?id=${encodeURIComponent(product.id)}">
      <span class="messenger-product-reference-image">${image}</span>
      <span class="messenger-product-reference-copy">
        <strong>${esc(product.title||'Product')}</strong>
        <span>${esc(formatPeso(product.price))}</span>
        <small>${product.creator?`by ${esc(product.creator)}`:'View product details'}</small>
      </span>
      <span class="messenger-product-reference-link">View product ›</span>
    </a>
  </article>`;
}

function humanFileSize(bytes){
  const value=Number(bytes||0);
  if(!value)return '';
  if(value<1024)return `${value} B`;
  if(value<1024*1024)return `${(value/1024).toFixed(1)} KB`;
  return `${(value/(1024*1024)).toFixed(1)} MB`;
}

function renderMessageAttachment(message){
  if(!message.attachment_url)return '';
  const url=esc(safeUrl(message.attachment_url,''));
  const name=esc(message.attachment_name||'Attachment');
  const type=String(message.attachment_type||'');
  if(type.startsWith('image/')){
    return `<a class="messenger-image-attachment" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${name}"></a>`;
  }
  return `<a class="messenger-file-attachment" href="${url}" target="_blank" rel="noopener">
    <span>📄</span><span><strong>${name}</strong><small>${humanFileSize(message.attachment_size)}</small></span><span>Download</span>
  </a>`;
}

function sanitizeAttachmentName(name){
  return String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100)||'file';
}

function showAttachmentPreview(file){
  const target=$('#messageAttachmentPreview');
  if(!target)return;
  if(!file){target.hidden=true;target.innerHTML='';return;}
  const isImage=file.type.startsWith('image/');
  target.hidden=false;
  target.innerHTML=`<div class="messenger-pending-attachment">
    ${isImage?`<img src="${URL.createObjectURL(file)}" alt="">`:'<span class="messenger-pending-file-icon">📄</span>'}
    <span><strong>${esc(file.name)}</strong><small>${humanFileSize(file.size)}</small></span>
    <button id="removePendingAttachment" type="button" aria-label="Remove attachment">×</button>
  </div>`;
  $('#removePendingAttachment').onclick=()=>{pendingAttachment=null;$('#messageAttachmentInput').value='';showAttachmentPreview(null);};
}

function chooseAttachment(accept){
  if(!active)return toast('Open a conversation before attaching a file.');
  const input=$('#messageAttachmentInput');
  input.accept=accept||'';
  input.click();
  $('#messageAttachmentModal')?.close?.();
}

async function uploadMessageAttachment(file){
  if(!file)return null;
  if(file.size>MAX_MESSAGE_ATTACHMENT_BYTES)throw new Error('Attachments must be 15 MB or smaller.');
  const allowed=['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'];
  if(!allowed.includes(file.type))throw new Error('This file type is not supported.');
  const path=`${currentUser.id}/${active}/${Date.now()}-${sanitizeAttachmentName(file.name)}`;
  const {error}=await sb.storage.from(MESSAGE_ATTACHMENTS_BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
  if(error)throw error;
  const {data}=sb.storage.from(MESSAGE_ATTACHMENTS_BUCKET).getPublicUrl(path);
  if(!data?.publicUrl)throw new Error('The attachment URL could not be created.');
  return {url:data.publicUrl,name:file.name,type:file.type,size:file.size};
}

async function shareConversationProduct(){
  const conversation=conversations.find(item=>item.id===active);
  if(!conversation?.product)return toast('This conversation has no product to share.');
  const product=conversation.product;
  const body=`🛍 ${product.title || 'Product'} — ${formatPeso(product.price)}\nproduct.html?id=${product.id}`;
  try{
    const {error}=await sb.from('messages').insert({conversation_id:active,sender_id:currentUser.id,body});
    if(error)throw error;
    $('#messageAttachmentModal')?.close?.();
    await loadMessages();
  }catch(error){toast(formatMessageError(error));}
}

function updateQuickReplies(messageCount){
  const wrap=$('#messageQuickReplies');
  if(!wrap)return;
  wrap.hidden=!active||messageCount>0;
}

async function loadMessages(){
  const conversation=conversations.find(item=>item.id===active);
  if(!conversation){
    renderEmptyChat();
    return;
  }

  const profile=conversation.otherProfile||{};
  const name=profile.full_name||profile.username||'Conversation';

  localStorage.setItem(READ_KEY_PREFIX+conversation.id,String(Date.now()));
  conversation.unread=false;

  $('#chatTitle').innerHTML=`<div class="messenger-chat-person">
    <span class="messenger-header-avatar">${profile.avatar_url
      ? `<img src="${esc(safeUrl(profile.avatar_url,''))}" alt="">`
      : esc(name.slice(0,1).toUpperCase())}</span>
    <div>
      <h2>${esc(name)}</h2>
      <p>${conversation.product?'Product conversation':'Direct message'}</p>
    </div>
  </div>`;

  const {data,error}=await sb.from('messages')
    .select('id,conversation_id,sender_id,body,attachment_url,attachment_name,attachment_type,attachment_size,created_at')
    .eq('conversation_id',active)
    .order('created_at',{ascending:true});

  if(error){
    toast(formatMessageError(error));
    return;
  }

  const container=$('#messages');
  const productReference=conversation.product?renderProductReference(conversation.product):'';
  const messageHistory=(data||[]).map(message=>{
    const attachment=renderMessageAttachment(message);
    const body=message.body?`<div class="messenger-message-text">${esc(message.body)}</div>`:'';
    return `<div class="messenger-message-row ${message.sender_id===currentUser.id?'mine':''}">
      <div class="messenger-bubble ${attachment?'has-attachment':''}">${attachment}${body}</div>
      <time>${formatConversationTime(message.created_at)}</time>
    </div>`;
  }).join('');

  updateQuickReplies((data||[]).length);
  container.innerHTML=productReference+(messageHistory
    ||'<div class="messenger-empty compact"><span>✉</span><strong>No messages yet</strong><p>Send the first message below.</p></div>');

  container.scrollTop=container.scrollHeight;
  renderConversationList();
}

async function send(event){
  event.preventDefault();
  if(!active)return toast('Select a conversation first.');

  const form=event.target;
  const data=new FormData(form);
  const body=String(data.get('body')||'').trim();
  if(!body&&!pendingAttachment)return;

  const button=form.querySelector('.messenger-send-button');
  button.disabled=true;

  try{
    const attachment=await uploadMessageAttachment(pendingAttachment);
    const payload={
      conversation_id:active,
      sender_id:currentUser.id,
      body:body||(attachment?`Attached ${attachment.name}`:'')
    };
    if(attachment){
      Object.assign(payload,{
        attachment_url:attachment.url,
        attachment_name:attachment.name,
        attachment_type:attachment.type,
        attachment_size:attachment.size
      });
    }
    const {error}=await sb.from('messages').insert(payload);
    if(error)throw error;
    form.reset();
    pendingAttachment=null;
    $('#messageAttachmentInput').value='';
    showAttachmentPreview(null);
    await loadMessages();
  }catch(error){
    console.error('Message send failed:',error);
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
  renderFollowingStrip();
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
  $('#openAttachmentMenu')?.addEventListener('click',()=>{
    if(!active)return toast('Open a conversation before attaching a file.');
    $('#messageAttachmentModal')?.showModal?.();
  });
  $('#closeAttachmentMenu')?.addEventListener('click',()=>$('#messageAttachmentModal')?.close?.());
  $$('[data-attachment-accept]').forEach(button=>button.addEventListener('click',()=>chooseAttachment(button.dataset.attachmentAccept)));
  $('#shareConversationProduct')?.addEventListener('click',shareConversationProduct);
  $$('[data-quick-reply]').forEach(button=>button.addEventListener('click',()=>{
    const input=$('#messageForm input[name="body"]');
    if(!input)return;
    input.value=button.dataset.quickReply||'';
    input.focus();
  }));
  $('#messageAttachmentInput')?.addEventListener('change',event=>{
    const file=event.target.files?.[0]||null;
    if(file&&file.size>MAX_MESSAGE_ATTACHMENT_BYTES){event.target.value='';return toast('Attachments must be 15 MB or smaller.');}
    pendingAttachment=file;
    showAttachmentPreview(file);
  });
  $('#conversationSearch')?.addEventListener('input',renderConversationList);
  $('#openCreatorSearch')?.addEventListener('click',openCreatorSearch);
  $('#openCreatorSearchSecondary')?.addEventListener('click',openCreatorSearch);
  $('#closeChatView')?.addEventListener('click',closeMobileChat);
  $('#closeCreatorSearch')?.addEventListener('click',()=>$('#creatorMessageModal')?.close?.());
  $('#creatorSearchInput')?.addEventListener('input',renderCreatorDirectory);
  $('#followingCreatorsTab')?.addEventListener('click',()=>setCreatorMode('following'));
  $('#allCreatorsTab')?.addEventListener('click',()=>setCreatorMode('all'));

  document.addEventListener('launchboard:auth-ready',()=>{
    loadConversations();
    loadCreatorDirectory().catch(()=>{});
  },{once:true});
  if(authReady){
    loadConversations();
    loadCreatorDirectory().catch(()=>{});
  }
});
