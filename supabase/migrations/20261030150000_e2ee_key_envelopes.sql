-- Per-device wrapped content keys for encrypted direct messages and private channels.
create table if not exists public.conversation_key_envelopes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  device_id uuid not null references public.user_crypto_devices(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  ephemeral_public_key jsonb not null,
  nonce text not null,
  wrapped_key text not null,
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (conversation_id, device_id, key_version)
);
alter table public.conversation_key_envelopes enable row level security;
drop policy if exists "conversation_key_envelopes_read_participants" on public.conversation_key_envelopes;
create policy "conversation_key_envelopes_read_participants" on public.conversation_key_envelopes
for select to authenticated using (
 exists(select 1 from public.conversation_participants cp
 where cp.conversation_id=conversation_key_envelopes.conversation_id and cp.user_id=(select auth.uid()))
);
drop policy if exists "conversation_key_envelopes_insert_participants" on public.conversation_key_envelopes;
create policy "conversation_key_envelopes_insert_participants" on public.conversation_key_envelopes
for insert to authenticated with check (
 created_by=(select auth.uid())
 and exists(select 1 from public.conversation_participants cp
 where cp.conversation_id=conversation_key_envelopes.conversation_id and cp.user_id=(select auth.uid()))
 and exists(select 1 from public.user_crypto_devices d
 where d.id=conversation_key_envelopes.device_id and d.revoked_at is null)
);

create table if not exists public.channel_key_envelopes (
 id uuid primary key default gen_random_uuid(),
 channel_id uuid not null references public.channels(id) on delete cascade,
 device_id uuid not null references public.user_crypto_devices(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 ephemeral_public_key jsonb not null,
 nonce text not null,
 wrapped_key text not null,
 key_version integer not null default 1,
 created_at timestamptz not null default now(),
 unique (channel_id, device_id, key_version)
);
alter table public.channel_key_envelopes enable row level security;
drop policy if exists "channel_key_envelopes_read_active" on public.channel_key_envelopes;
create policy "channel_key_envelopes_read_active" on public.channel_key_envelopes
for select to authenticated using (
 exists(select 1 from public.channel_members cm
 where cm.channel_id=channel_key_envelopes.channel_id and cm.user_id=(select auth.uid()) and cm.status='active')
);
drop policy if exists "channel_key_envelopes_insert_active" on public.channel_key_envelopes;
create policy "channel_key_envelopes_insert_active" on public.channel_key_envelopes
for insert to authenticated with check (
 created_by=(select auth.uid())
 and exists(select 1 from public.channel_members cm
 where cm.channel_id=channel_key_envelopes.channel_id and cm.user_id=(select auth.uid()) and cm.status='active')
 and exists(select 1 from public.user_crypto_devices d
 where d.id=channel_key_envelopes.device_id and d.revoked_at is null)
);
