-- Device public-key registry and private encrypted-media storage.
-- Message bodies remain backward compatible; clients must only write ciphertext
-- after completing the E2EE key exchange implementation.

create table if not exists public.user_crypto_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null default 'Este dispositivo',
  public_key text not null,
  algorithm text not null default 'ECDH-P256',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint user_crypto_devices_user_device_unique unique (user_id, id)
);
create index if not exists user_crypto_devices_user_active_idx
  on public.user_crypto_devices(user_id) where revoked_at is null;
alter table public.user_crypto_devices enable row level security;
create policy "crypto_devices_read_authenticated"
  on public.user_crypto_devices for select to authenticated using (revoked_at is null);
create policy "crypto_devices_insert_own"
  on public.user_crypto_devices for insert to authenticated with check (user_id = (select auth.uid()));
create policy "crypto_devices_update_own"
  on public.user_crypto_devices for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "crypto_devices_delete_own"
  on public.user_crypto_devices for delete to authenticated using (user_id = (select auth.uid()));

alter table public.messages
  add column if not exists encryption_version smallint,
  add column if not exists encryption_nonce text,
  add column if not exists encryption_metadata jsonb;
alter table public.channel_messages
  add column if not exists encryption_version smallint,
  add column if not exists encryption_nonce text,
  add column if not exists encryption_metadata jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-chat-media', 'private-chat-media', false, 104857600, array['application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "chat_media_read_participants" on storage.objects
for select to authenticated using (
  bucket_id = 'private-chat-media'
  and (
    ((storage.foldername(name))[1] = 'dm' and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id::text = (storage.foldername(name))[2]
        and cp.user_id = (select auth.uid())
    ))
    or
    ((storage.foldername(name))[1] = 'channel' and exists (
      select 1 from public.channel_members cm
      where cm.channel_id::text = (storage.foldername(name))[2]
        and cm.user_id = (select auth.uid()) and cm.status = 'active'
    ))
  )
);
create policy "chat_media_upload_own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'private-chat-media'
  and (storage.foldername(name))[3] = (select auth.uid())::text
  and (
    ((storage.foldername(name))[1] = 'dm' and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id::text = (storage.foldername(name))[2]
        and cp.user_id = (select auth.uid())
    ))
    or
    ((storage.foldername(name))[1] = 'channel' and exists (
      select 1 from public.channel_members cm
      where cm.channel_id::text = (storage.foldername(name))[2]
        and cm.user_id = (select auth.uid()) and cm.status = 'active'
    ))
  )
);
create policy "chat_media_delete_own" on storage.objects
for delete to authenticated using (
  bucket_id = 'private-chat-media' and (storage.foldername(name))[3] = (select auth.uid())::text
);
