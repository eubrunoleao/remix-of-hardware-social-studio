-- Fix recursive RLS evaluation on conversation_participants.
-- The previous SELECT policy queried conversation_participants from itself,
-- which causes PostgreSQL's "infinite recursion detected in policy" error.

create or replace function public.is_conversation_participant(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = _conversation_id
        and cp.user_id = auth.uid()
    );
$$;

revoke all on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

drop policy if exists conversation_participants_member_read on public.conversation_participants;
create policy conversation_participants_member_read
on public.conversation_participants
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_conversation_participant(conversation_id)
);
