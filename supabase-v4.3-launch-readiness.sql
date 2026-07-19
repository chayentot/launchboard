-- LaunchBoard V4.3 reporting and launch-readiness migration
-- Safe to run more than once.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check(target_type in ('product','creator','review','message')),
  target_id uuid not null,
  reason text not null,
  details text not null check(char_length(details) between 3 and 800),
  status text not null default 'open' check(status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

alter table public.reports enable row level security;

drop policy if exists "Members submit reports" on public.reports;
create policy "Members submit reports"
on public.reports for insert to authenticated
with check(reporter_id=auth.uid());

drop policy if exists "Members see own reports" on public.reports;
create policy "Members see own reports"
on public.reports for select to authenticated
using(reporter_id=auth.uid() or public.is_launchboard_admin());

create or replace function public.admin_list_reports()
returns table(
  id uuid,
  reporter_id uuid,
  reporter_email text,
  target_type text,
  target_id uuid,
  reason text,
  details text,
  status text,
  created_at timestamptz
)
language sql stable security definer set search_path=public,auth as $$
  select r.id,r.reporter_id,u.email::text,r.target_type,r.target_id,r.reason,r.details,r.status,r.created_at
  from public.reports r
  left join auth.users u on u.id=r.reporter_id
  where public.is_launchboard_admin() and r.status='open'
  order by r.created_at desc
$$;
grant execute on function public.admin_list_reports() to authenticated;

create or replace function public.admin_resolve_report(target_report uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_launchboard_admin() then raise exception 'Access denied'; end if;
  update public.reports
  set status='resolved',resolved_at=now(),resolved_by=auth.uid()
  where id=target_report;
end $$;
grant execute on function public.admin_resolve_report(uuid) to authenticated;

create index if not exists reports_status_created_idx on public.reports(status,created_at desc);
create index if not exists reports_target_idx on public.reports(target_type,target_id);
