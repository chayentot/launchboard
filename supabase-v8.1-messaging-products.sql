-- LaunchBoard V8.1: message-only inbox, file attachments, unread state,
-- and new-product notifications for followers.
begin;

-- Keep notification schema compatible with older and fresh installs.
alter table public.notifications add column if not exists actor_id uuid references public.profiles(id) on delete set null;
alter table public.notifications add column if not exists type text not null default 'general';

create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.conversation_members cm where cm.conversation_id=target_conversation and cm.user_id=auth.uid());
$$;
grant execute on function public.is_conversation_member(uuid) to authenticated;

-- Stop chat messages from creating activity notifications.
drop trigger if exists message_notification on public.messages;
drop function if exists public.notify_message();
delete from public.notifications where type='message';

-- Per-conversation read state.
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);
alter table public.conversation_reads enable row level security;
drop policy if exists "Members manage own read state" on public.conversation_reads;
create policy "Members manage own read state" on public.conversation_reads
for all to authenticated
using (user_id=auth.uid() and public.is_conversation_member(conversation_id))
with check (user_id=auth.uid() and public.is_conversation_member(conversation_id));

-- Message attachments.
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size bigint not null check(file_size between 1 and 15728640),
  storage_path text not null,
  public_url text,
  created_at timestamptz not null default now()
);
create index if not exists message_attachments_message_idx on public.message_attachments(message_id);
alter table public.message_attachments enable row level security;
drop policy if exists "Members read message attachments" on public.message_attachments;
create policy "Members read message attachments" on public.message_attachments
for select to authenticated using (
  exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id))
);
drop policy if exists "Users add own message attachments" on public.message_attachments;
create policy "Users add own message attachments" on public.message_attachments
for insert to authenticated with check (
  uploader_id=auth.uid() and exists(select 1 from public.messages m where m.id=message_id and m.sender_id=auth.uid() and public.is_conversation_member(m.conversation_id))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-attachments','chat-attachments',true,15728640,array[
  'image/jpeg','image/png','image/webp','image/gif','application/pdf',
  'text/plain','text/csv','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]) on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Authenticated upload chat attachments" on storage.objects;
create policy "Authenticated upload chat attachments" on storage.objects
for insert to authenticated with check(bucket_id='chat-attachments' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Public read chat attachments" on storage.objects;
create policy "Public read chat attachments" on storage.objects for select to public using(bucket_id='chat-attachments');

-- Notify followers when a creator publishes a new product.
create or replace function public.notify_followers_new_product()
returns trigger language plpgsql security definer set search_path=public as $$
declare creator_name text;
begin
  if tg_op='INSERT' then
    select coalesce(full_name,username,'A creator') into creator_name from public.profiles where id=new.owner_id;
    insert into public.notifications(user_id,actor_id,type,title,body,link)
    select f.follower_id,new.owner_id,'new_product','New product from '||creator_name,new.title,'product.html?id='||new.id
    from public.creator_follows f where f.creator_id=new.owner_id and f.follower_id<>new.owner_id;
  end if;
  return new;
end $$;
drop trigger if exists new_product_follower_notification on public.products;
create trigger new_product_follower_notification after insert on public.products
for each row execute function public.notify_followers_new_product();

notify pgrst,'reload schema';
commit;
