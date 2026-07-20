-- LaunchBoard v7.4.1 Notifications
-- Run once in Supabase Dashboard > SQL Editor.

begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_read)
  where is_read = false;

alter table public.notifications enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname='public'
      and tablename='notifications'
  loop
    execute format(
      'drop policy if exists %I on public.notifications',
      policy_record.policyname
    );
  end loop;
end
$$;

create policy "Users read own notifications"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy "Users update own notifications"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users delete own notifications"
on public.notifications
for delete
to authenticated
using (user_id = auth.uid());

notify pgrst, 'reload schema';

commit;
