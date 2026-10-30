-- Conversation RPCs used by src/lib/social.ts.
-- All authorization decisions are derived from auth.uid(); callers cannot impersonate another user.

create or replace function public.create_conversation(_other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_conversation_id uuid;
begin
  if v_me is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if _other_user is null or _other_user = v_me then
    raise exception 'Invalid recipient' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = _other_user) then
    raise exception 'Recipient not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_me and b.blocked_id = _other_user)
       or (b.blocker_id = _other_user and b.blocked_id = v_me)
  ) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(v_me::text, _other_user::text) || ':' || greatest(v_me::text, _other_user::text), 0
  ));

  select c.id into v_conversation_id
  from public.conversations c
  where exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = c.id and cp.user_id = v_me
  )
  and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = c.id and cp.user_id = _other_user
  )
  order by c.created_at desc
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (requester_id, accepted)
  values (v_me, false)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, v_me), (v_conversation_id, _other_user);

  return v_conversation_id;
end;
$$;

create or replace function public.respond_conversation(_conversation_id uuid, _accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_requester uuid;
begin
  if v_me is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select c.requester_id into v_requester
  from public.conversations c
  where c.id = _conversation_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = v_me
    );

  if v_requester is null then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if v_requester = v_me then
    raise exception 'Only the recipient can respond' using errcode = '42501';
  end if;

  if _accept then
    update public.conversations set accepted = true where id = _conversation_id;
  else
    delete from public.conversations where id = _conversation_id;
  end if;
end;
$$;

create or replace function public.send_message(_conversation_id uuid, _body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_requester uuid;
  v_accepted boolean;
  v_message_id uuid;
begin
  if v_me is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if _body is null or char_length(btrim(_body)) < 1 or char_length(_body) > 5000 then
    raise exception 'Message must contain 1 to 5000 characters' using errcode = '22023';
  end if;

  select c.requester_id, c.accepted into v_requester, v_accepted
  from public.conversations c
  where c.id = _conversation_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = v_me
    );

  if v_requester is null then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if not v_accepted and v_requester <> v_me then
    raise exception 'Conversation request has not been accepted' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.conversation_participants cp
    join public.blocks b
      on (b.blocker_id = v_me and b.blocked_id = cp.user_id)
      or (b.blocker_id = cp.user_id and b.blocked_id = v_me)
    where cp.conversation_id = _conversation_id and cp.user_id <> v_me
  ) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (_conversation_id, v_me, btrim(_body))
  returning id into v_message_id;

  return v_message_id;
end;
$$;

revoke all on function public.create_conversation(uuid) from public, anon;
revoke all on function public.respond_conversation(uuid, boolean) from public, anon;
revoke all on function public.send_message(uuid, text) from public, anon;
grant execute on function public.create_conversation(uuid) to authenticated;
grant execute on function public.respond_conversation(uuid, boolean) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
