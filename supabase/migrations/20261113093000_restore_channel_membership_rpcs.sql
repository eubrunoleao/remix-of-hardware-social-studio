-- Restore the channel membership RPCs called by src/lib/channels.ts.
-- Membership is always tied to auth.uid(); callers cannot join on behalf of another user.

create or replace function public.join_channel(_channel_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_visibility text;
  v_requires_approval boolean;
  v_status text;
  v_existing_status text;
begin
  if v_user_id is null then
    raise exception 'Você precisa entrar na sua conta para participar de um canal.' using errcode = '28000';
  end if;

  select c.visibility, coalesce(c.join_approval, false)
    into v_visibility, v_requires_approval
  from public.channels c
  where c.id = _channel_id;

  if not found then
    raise exception 'Canal não encontrado.' using errcode = 'P0002';
  end if;

  if v_visibility is distinct from 'public' then
    raise exception 'Este canal não permite entrada direta. Solicite acesso ao administrador.' using errcode = '42501';
  end if;

  select cm.status into v_existing_status
  from public.channel_members cm
  where cm.channel_id = _channel_id and cm.user_id = v_user_id
  for update;

  if v_existing_status = 'banned' then
    raise exception 'Você foi bloqueado neste canal.' using errcode = '42501';
  end if;

  if v_existing_status = 'active' then
    insert into public.channel_follows (channel_id, user_id)
    values (_channel_id, v_user_id)
    on conflict (channel_id, user_id) do nothing;
    return 'active';
  end if;

  v_status := case when v_requires_approval then 'pending' else 'active' end;

  insert into public.channel_members (channel_id, user_id, role, status)
  values (_channel_id, v_user_id, 'member', v_status)
  on conflict (channel_id, user_id)
  do update set status = excluded.status
  where public.channel_members.status <> 'banned';

  if v_status = 'active' then
    insert into public.channel_follows (channel_id, user_id)
    values (_channel_id, v_user_id)
    on conflict (channel_id, user_id) do nothing;
  end if;

  return v_status;
end;
$$;

create or replace function public.leave_channel(_channel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if exists (
    select 1 from public.channel_members cm
    where cm.channel_id = _channel_id
      and cm.user_id = v_user_id
      and cm.role = 'owner'
  ) then
    raise exception 'O proprietário não pode sair do próprio canal.' using errcode = '42501';
  end if;

  delete from public.channel_follows
  where channel_id = _channel_id and user_id = v_user_id;

  delete from public.channel_members
  where channel_id = _channel_id and user_id = v_user_id;
end;
$$;

revoke all on function public.join_channel(uuid) from public, anon;
revoke all on function public.leave_channel(uuid) from public, anon;
grant execute on function public.join_channel(uuid) to authenticated;
grant execute on function public.leave_channel(uuid) to authenticated;

notify pgrst, 'reload schema';
