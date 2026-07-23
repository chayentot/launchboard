-- LaunchBoard V9.5
-- This release uses the existing product_likes and creator_follows tables.
-- Run only the policy statements you need. Existing equivalent policies may
-- already be present in your project.

alter table public.product_likes enable row level security;
alter table public.creator_follows enable row level security;

drop policy if exists "Users can read own product likes" on public.product_likes;
create policy "Users can read own product likes"
on public.product_likes for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can delete own product likes" on public.product_likes;
create policy "Users can delete own product likes"
on public.product_likes for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own follows" on public.creator_follows;
create policy "Users can read own follows"
on public.creator_follows for select
to authenticated
using (auth.uid() = follower_id);

drop policy if exists "Users can delete own follows" on public.creator_follows;
create policy "Users can delete own follows"
on public.creator_follows for delete
to authenticated
using (auth.uid() = follower_id);

-- Public product/profile reads are required by the pages.
drop policy if exists "Published products are publicly readable" on public.products;
create policy "Published products are publicly readable"
on public.products for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
on public.profiles for select
to anon, authenticated
using (coalesce(is_banned,false) = false);
