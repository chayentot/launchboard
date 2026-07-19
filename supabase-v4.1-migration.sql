-- LaunchBoard V4.1 consolidated migration
-- Run in Supabase SQL Editor as one NEW query.
-- Idempotent: it preserves existing users and products.

create extension if not exists pgcrypto;

-- Core tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text,
  bio text not null default '',
  avatar_url text,
  website_url text,
  location text,
  is_verified boolean not null default false,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  creator text not null,
  price text,
  category text not null default 'Other',
  product_type text not null default 'Physical',
  brand text,
  country text,
  image_url text,
  product_url text not null,
  description text not null default '',
  tags text[] not null default '{}',
  is_published boolean not null default true,
  is_featured boolean not null default false,
  is_premium boolean not null default false,
  premium_until timestamptz,
  clicks bigint not null default 0,
  views bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade older installations safely
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists website_url text;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.products add column if not exists tags text[] not null default '{}';
alter table public.products add column if not exists product_type text not null default 'Physical';
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists country text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists product_url text;
alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists is_published boolean not null default true;
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists is_premium boolean not null default false;
alter table public.products add column if not exists premium_until timestamptz;
alter table public.products add column if not exists clicks bigint not null default 0;
alter table public.products add column if not exists views bigint not null default 0;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();

alter table public.products drop constraint if exists products_title_length_allowed;
alter table public.products add constraint products_title_length_allowed
check (char_length(title) between 1 and 80) not valid;

create table if not exists public.product_likes (
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(product_id,user_id)
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check(rating between 1 and 5),
  body text not null check(char_length(body) between 3 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,author_id)
);

create table if not exists public.creator_follows (
  creator_id uuid not null references public.profiles(id) on delete cascade,
  follower_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(creator_id,follower_id),
  check(creator_id<>follower_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null default 'general',
  title text not null,
  body text not null default '',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- New-user profile trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,username)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),
    lower(regexp_replace(split_part(new.email,'@',1),'[^a-zA-Z0-9_-]+','','g'))
  )
  on conflict(id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for existing Auth users
insert into public.profiles(id,full_name,username)
select id,
       coalesce(raw_user_meta_data->>'full_name',split_part(email,'@',1)),
       lower(regexp_replace(split_part(email,'@',1),'[^a-zA-Z0-9_-]+','','g'))
from auth.users
on conflict(id) do nothing;

-- Admin helper must exist before policies reference it
create or replace function public.is_launchboard_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and is_admin=true and is_banned=false
  )
$$;
grant execute on function public.is_launchboard_admin() to authenticated;

-- Storage
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']),
('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update
set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public launchboard images" on storage.objects;
create policy "Public launchboard images"
on storage.objects for select using(bucket_id in ('product-images','avatars'));

drop policy if exists "Users upload launchboard images" on storage.objects;
create policy "Users upload launchboard images"
on storage.objects for insert to authenticated
with check(
  bucket_id in ('product-images','avatars')
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "Users update launchboard images" on storage.objects;
create policy "Users update launchboard images"
on storage.objects for update to authenticated
using(bucket_id in ('product-images','avatars') and owner_id=auth.uid()::text)
with check(bucket_id in ('product-images','avatars') and owner_id=auth.uid()::text);

drop policy if exists "Users delete launchboard images" on storage.objects;
create policy "Users delete launchboard images"
on storage.objects for delete to authenticated
using(bucket_id in ('product-images','avatars') and owner_id=auth.uid()::text);

-- RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_likes enable row level security;
alter table public.product_reviews enable row level security;
alter table public.creator_follows enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Public profiles visible" on public.profiles;
create policy "Public profiles visible" on public.profiles
for select using(is_banned=false or id=auth.uid() or public.is_launchboard_admin());

drop policy if exists "Public products visible" on public.products;
create policy "Public products visible" on public.products
for select using(
  (is_published=true and not exists(
    select 1 from public.profiles p where p.id=owner_id and p.is_banned=true
  ))
  or owner_id=auth.uid()
  or public.is_launchboard_admin()
);

drop policy if exists "Creators publish products" on public.products;
create policy "Creators publish products" on public.products
for insert to authenticated
with check(
  owner_id=auth.uid()
  and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_banned=true)
);

drop policy if exists "Creators update own products" on public.products;
create policy "Creators update own products" on public.products
for update to authenticated
using(owner_id=auth.uid() or public.is_launchboard_admin())
with check(owner_id=auth.uid() or public.is_launchboard_admin());

drop policy if exists "Creators delete own products" on public.products;
create policy "Creators delete own products" on public.products
for delete to authenticated
using(owner_id=auth.uid() or public.is_launchboard_admin());

drop policy if exists "Likes publicly readable" on public.product_likes;
create policy "Likes publicly readable" on public.product_likes for select using(true);
drop policy if exists "Members manage own likes" on public.product_likes;
create policy "Members manage own likes" on public.product_likes
for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists "Reviews publicly readable" on public.product_reviews;
create policy "Reviews publicly readable" on public.product_reviews for select using(true);
drop policy if exists "Members create reviews" on public.product_reviews;
create policy "Members create reviews" on public.product_reviews
for insert to authenticated with check(author_id=auth.uid());
drop policy if exists "Members update reviews" on public.product_reviews;
create policy "Members update reviews" on public.product_reviews
for update to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());
drop policy if exists "Members delete reviews" on public.product_reviews;
create policy "Members delete reviews" on public.product_reviews
for delete to authenticated using(author_id=auth.uid() or public.is_launchboard_admin());

drop policy if exists "Follows publicly readable" on public.creator_follows;
create policy "Follows publicly readable" on public.creator_follows for select using(true);
drop policy if exists "Members manage follows" on public.creator_follows;
create policy "Members manage follows" on public.creator_follows
for all to authenticated using(follower_id=auth.uid()) with check(follower_id=auth.uid());

drop policy if exists "Members see conversations" on public.conversations;
create policy "Members see conversations" on public.conversations
for select to authenticated using(
  exists(select 1 from public.conversation_members cm
         where cm.conversation_id=id and cm.user_id=auth.uid())
);

drop policy if exists "Members see conversation membership" on public.conversation_members;
create policy "Members see conversation membership" on public.conversation_members
for select to authenticated using(
  exists(select 1 from public.conversation_members mine
         where mine.conversation_id=conversation_id and mine.user_id=auth.uid())
);

drop policy if exists "Members read messages" on public.messages;
create policy "Members read messages" on public.messages
for select to authenticated using(
  exists(select 1 from public.conversation_members cm
         where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid())
);
drop policy if exists "Members send messages" on public.messages;
create policy "Members send messages" on public.messages
for insert to authenticated with check(
  sender_id=auth.uid()
  and exists(select 1 from public.conversation_members cm
             where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid())
);

drop policy if exists "Members see own notifications" on public.notifications;
create policy "Members see own notifications" on public.notifications
for select to authenticated using(user_id=auth.uid());
drop policy if exists "Members update own notifications" on public.notifications;
create policy "Members update own notifications" on public.notifications
for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Public functions
create or replace function public.update_my_profile(
  p_full_name text,p_username text,p_bio text,p_avatar_url text,p_website_url text,p_location text
) returns void language plpgsql security definer set search_path=public as $$
begin
  update public.profiles
  set full_name=left(trim(coalesce(p_full_name,'')),80),
      username=lower(left(regexp_replace(trim(coalesce(p_username,'')),'[^a-zA-Z0-9_-]+','','g'),40)),
      bio=left(coalesce(p_bio,''),500),
      avatar_url=nullif(trim(p_avatar_url),''),
      website_url=nullif(trim(p_website_url),''),
      location=nullif(trim(p_location),''),
      updated_at=now()
  where id=auth.uid() and is_banned=false;
end $$;
grant execute on function public.update_my_profile(text,text,text,text,text,text) to authenticated;

create or replace function public.increment_product_views(product_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.products set views=views+1 where id=product_id and is_published=true
$$;
grant execute on function public.increment_product_views(uuid) to anon,authenticated;

create or replace function public.increment_product_clicks(product_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.products set clicks=clicks+1 where id=product_id and is_published=true
$$;
grant execute on function public.increment_product_clicks(uuid) to anon,authenticated;

create or replace function public.creator_analytics()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'products',(select count(*) from public.products where owner_id=auth.uid()),
    'views',(select coalesce(sum(views),0) from public.products where owner_id=auth.uid()),
    'clicks',(select coalesce(sum(clicks),0) from public.products where owner_id=auth.uid()),
    'likes',(select count(*) from public.product_likes l join public.products p on p.id=l.product_id where p.owner_id=auth.uid()),
    'followers',(select count(*) from public.creator_follows where creator_id=auth.uid()),
    'reviews',(select count(*) from public.product_reviews r join public.products p on p.id=r.product_id where p.owner_id=auth.uid())
  )
$$;
grant execute on function public.creator_analytics() to authenticated;

create or replace function public.start_conversation(target_user uuid,target_product uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare conversation_id uuid;
begin
  if auth.uid() is null or target_user is null or target_user=auth.uid() then
    raise exception 'Invalid conversation';
  end if;

  select c.id into conversation_id
  from public.conversations c
  join public.conversation_members a on a.conversation_id=c.id and a.user_id=auth.uid()
  join public.conversation_members b on b.conversation_id=c.id and b.user_id=target_user
  where c.product_id is not distinct from target_product
  limit 1;

  if conversation_id is null then
    insert into public.conversations(product_id) values(target_product) returning id into conversation_id;
    insert into public.conversation_members(conversation_id,user_id)
    values(conversation_id,auth.uid()),(conversation_id,target_user);
  end if;
  return conversation_id;
end $$;
grant execute on function public.start_conversation(uuid,uuid) to authenticated;

-- Notification triggers
create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,actor_id,type,title,body,link)
  values(new.creator_id,new.follower_id,'follow','New follower','Someone followed your creator profile.','creator.html?id='||new.follower_id);
  return new;
end $$;
drop trigger if exists creator_follow_notification on public.creator_follows;
create trigger creator_follow_notification after insert on public.creator_follows
for each row execute function public.notify_follow();

create or replace function public.notify_like()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner uuid; product_title text;
begin
  select owner_id,title into owner,product_title from public.products where id=new.product_id;
  if owner<>new.user_id then
    insert into public.notifications(user_id,actor_id,type,title,body,link)
    values(owner,new.user_id,'like','New product like',product_title,'product.html?id='||new.product_id);
  end if;
  return new;
end $$;
drop trigger if exists product_like_notification on public.product_likes;
create trigger product_like_notification after insert on public.product_likes
for each row execute function public.notify_like();

create or replace function public.notify_review()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner uuid; product_title text;
begin
  select owner_id,title into owner,product_title from public.products where id=new.product_id;
  if owner<>new.author_id then
    insert into public.notifications(user_id,actor_id,type,title,body,link)
    values(owner,new.author_id,'review','New product review',product_title,'product.html?id='||new.product_id);
  end if;
  return new;
end $$;
drop trigger if exists product_review_notification on public.product_reviews;
create trigger product_review_notification after insert on public.product_reviews
for each row execute function public.notify_review();

create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,actor_id,type,title,body,link)
  select cm.user_id,new.sender_id,'message','New message',left(new.body,120),
         'messages.html?conversation='||new.conversation_id
  from public.conversation_members cm
  where cm.conversation_id=new.conversation_id and cm.user_id<>new.sender_id;
  update public.conversations set updated_at=now() where id=new.conversation_id;
  return new;
end $$;
drop trigger if exists message_notification on public.messages;
create trigger message_notification after insert on public.messages
for each row execute function public.notify_message();

-- Admin RPCs
create or replace function public.admin_list_users()
returns table(id uuid,email text,full_name text,username text,is_verified boolean,is_admin boolean,is_banned boolean,created_at timestamptz)
language sql stable security definer set search_path=public,auth as $$
  select p.id,u.email,p.full_name,p.username,p.is_verified,p.is_admin,p.is_banned,p.created_at
  from public.profiles p join auth.users u on u.id=p.id
  where public.is_launchboard_admin()
  order by p.created_at desc
$$;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_list_products()
returns setof public.products language sql stable security definer set search_path=public as $$
  select p.* from public.products p
  where public.is_launchboard_admin()
  order by p.created_at desc
$$;
grant execute on function public.admin_list_products() to authenticated;

create or replace function public.admin_dashboard_stats()
returns jsonb language sql stable security definer set search_path=public as $$
  select case when public.is_launchboard_admin() then jsonb_build_object(
    'users',(select count(*) from public.profiles),
    'products',(select count(*) from public.products),
    'clicks',(select coalesce(sum(clicks),0) from public.products),
    'banned_users',(select count(*) from public.profiles where is_banned),
    'products_today',(select count(*) from public.products where created_at>=date_trunc('day',now()))
  ) else '{}'::jsonb end
$$;
grant execute on function public.admin_dashboard_stats() to authenticated;

create or replace function public.admin_set_verified(target_user uuid,new_value boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_launchboard_admin() then raise exception 'Access denied'; end if;
  update public.profiles set is_verified=new_value where id=target_user;
end $$;
grant execute on function public.admin_set_verified(uuid,boolean) to authenticated;

create or replace function public.admin_set_user_banned(target_user_id uuid,banned boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_launchboard_admin() then raise exception 'Access denied'; end if;
  if target_user_id=auth.uid() then raise exception 'You cannot ban your own administrator account'; end if;
  update public.profiles set is_banned=banned where id=target_user_id;
end $$;
grant execute on function public.admin_set_user_banned(uuid,boolean) to authenticated;

create or replace function public.admin_set_premium(target_product uuid,new_value boolean,days_count integer default 30)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_launchboard_admin() then raise exception 'Access denied'; end if;
  update public.products
  set is_premium=new_value,
      premium_until=case when new_value then now()+make_interval(days=>greatest(days_count,1)) else null end
  where id=target_product;
end $$;
grant execute on function public.admin_set_premium(uuid,boolean,integer) to authenticated;

-- Helpful indexes
create index if not exists products_owner_idx on public.products(owner_id);
create index if not exists products_created_idx on public.products(created_at desc);
create index if not exists notifications_user_idx on public.notifications(user_id,created_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id,created_at);
