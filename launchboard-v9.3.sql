-- LaunchBoard V9.3 — database-backed creator onboarding
-- Run once in Supabase SQL Editor.

begin;

-- Add nullable first so existing members can be grandfathered safely.
alter table public.profiles
  add column if not exists onboarding_completed boolean,
  add column if not exists following_count integer;

-- Existing members should not be forced through first-time onboarding.
update public.profiles
set onboarding_completed = true
where onboarding_completed is null;

-- Synchronize each existing member's real follow count.
update public.profiles p
set following_count = coalesce((
  select count(*)::integer
  from public.creator_follows f
  where f.follower_id = p.id
),0)
where following_count is null;

alter table public.profiles
  alter column onboarding_completed set default false,
  alter column onboarding_completed set not null,
  alter column following_count set default 0,
  alter column following_count set not null;

-- Keep onboarding state synchronized with creator_follows.
create or replace function public.sync_launchboard_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  total integer;
begin
  target_user := coalesce(new.follower_id, old.follower_id);

  select count(*)::integer into total
  from public.creator_follows
  where follower_id = target_user;

  update public.profiles
  set following_count = total,
      onboarding_completed = (total >= 5)
  where id = target_user;

  return coalesce(new,old);
end;
$$;

drop trigger if exists launchboard_sync_onboarding_after_follow on public.creator_follows;
create trigger launchboard_sync_onboarding_after_follow
after insert or delete on public.creator_follows
for each row execute function public.sync_launchboard_onboarding();

-- Prevent duplicate follow rows. Skip harmlessly if an equivalent constraint exists.
create unique index if not exists creator_follows_follower_creator_unique
on public.creator_follows(follower_id,creator_id);

commit;
