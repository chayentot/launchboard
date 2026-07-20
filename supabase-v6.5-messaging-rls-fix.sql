-- LaunchBoard v6.5 messaging RLS repair
-- Run this once in Supabase Dashboard > SQL Editor.

begin;

-- A SECURITY DEFINER helper avoids querying conversation_members from inside
-- its own row-level policy, which caused infinite recursion.
create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

drop policy if exists "Members see conversation membership" on public.conversation_members;
create policy "Members see conversation membership"
on public.conversation_members
for select
to authenticated
using (public.is_conversation_member(conversation_id));

drop policy if exists "Members see conversations" on public.conversations;
create policy "Members see conversations"
on public.conversations
for select
to authenticated
using (public.is_conversation_member(id));

drop policy if exists "Members read messages" on public.messages;
create policy "Members read messages"
on public.messages
for select
to authenticated
using (public.is_conversation_member(conversation_id));

drop policy if exists "Members send messages" on public.messages;
create policy "Members send messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

-- Optional update/delete policies for a sender's own message.
drop policy if exists "Members update own messages" on public.messages;
create policy "Members update own messages"
on public.messages
for update
to authenticated
using (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
)
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

drop policy if exists "Members delete own messages" on public.messages;
create policy "Members delete own messages"
on public.messages
for delete
to authenticated
using (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

-- Ensure the conversation starter remains callable.
grant execute on function public.start_conversation(uuid,uuid) to authenticated;

-- Refresh PostgREST's schema cache after policy/function changes.
notify pgrst, 'reload schema';

commit;
