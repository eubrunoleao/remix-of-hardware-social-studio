
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  bio text check (char_length(bio) <= 280),
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; candidate text; n int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := 'user' || base; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1; candidate := base || n::text;
  end loop;
  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, left(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', candidate), 50));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name text not null, sort int not null default 0
);
create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name text not null
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category_id uuid not null references public.categories(id),
  manufacturer_id uuid not null references public.manufacturers(id),
  specs jsonb not null default '{}'::jsonb,
  specs_verified boolean not null default false,
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);
create index products_name_idx on public.products using gin (to_tsvector('simple', name));
grant select on public.categories, public.manufacturers, public.products to anon, authenticated;
grant all on public.categories, public.manufacturers, public.products to service_role;
alter table public.categories enable row level security;
alter table public.manufacturers enable row level security;
alter table public.products enable row level security;
create policy "read" on public.categories for select using (true);
create policy "read" on public.manufacturers for select using (true);
create policy "read" on public.products for select using (true);

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index on public.user_devices(product_id);
grant select on public.user_devices to anon, authenticated;
grant insert, delete on public.user_devices to authenticated;
grant all on public.user_devices to service_role;
alter table public.user_devices enable row level security;
create policy "read" on public.user_devices for select using (true);
create policy "own insert" on public.user_devices for insert to authenticated with check (auth.uid() = user_id);
create policy "own delete" on public.user_devices for delete to authenticated using (auth.uid() = user_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  category_id uuid references public.categories(id),
  is_review boolean not null default false,
  rating smallint check (rating between 1 and 5),
  client_key uuid not null,
  created_at timestamptz not null default now(),
  unique (author_id, client_key)
);
create index on public.posts(created_at desc);
create table public.post_products (
  post_id uuid not null references public.posts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (post_id, product_id)
);
create index on public.post_products(product_id);
create table public.hashtags (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique check (tag ~ '^[a-z0-9]{2,30}$'),
  label text not null
);
create table public.post_hashtags (
  post_id uuid not null references public.posts(id) on delete cascade,
  hashtag_id uuid not null references public.hashtags(id) on delete cascade,
  primary key (post_id, hashtag_id)
);
create index on public.post_hashtags(hashtag_id);
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on public.comments(post_id, created_at);

grant select on public.posts, public.post_products, public.hashtags, public.post_hashtags, public.post_likes, public.comments to anon, authenticated;
grant delete on public.posts to authenticated;
grant insert, delete on public.post_likes, public.post_saves to authenticated;
grant select on public.post_saves to authenticated;
grant insert, delete on public.comments to authenticated;
grant all on public.posts, public.post_products, public.hashtags, public.post_hashtags, public.post_likes, public.post_saves, public.comments to service_role;

alter table public.posts enable row level security;
alter table public.post_products enable row level security;
alter table public.hashtags enable row level security;
alter table public.post_hashtags enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.comments enable row level security;
create policy "read" on public.posts for select using (true);
create policy "own delete" on public.posts for delete to authenticated using (auth.uid() = author_id);
create policy "read" on public.post_products for select using (true);
create policy "read" on public.hashtags for select using (true);
create policy "read" on public.post_hashtags for select using (true);
create policy "read" on public.post_likes for select using (true);
create policy "own insert" on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "own delete" on public.post_likes for delete to authenticated using (auth.uid() = user_id);
create policy "own read" on public.post_saves for select to authenticated using (auth.uid() = user_id);
create policy "own insert" on public.post_saves for insert to authenticated with check (auth.uid() = user_id);
create policy "own delete" on public.post_saves for delete to authenticated using (auth.uid() = user_id);
create policy "read" on public.comments for select using (true);
create policy "own insert" on public.comments for insert to authenticated with check (auth.uid() = author_id);
create policy "own delete" on public.comments for delete to authenticated using (auth.uid() = author_id);

create or replace function public.normalize_hashtag(raw text) returns text
language sql immutable set search_path = public as $$
  select lower(regexp_replace(translate(raw,
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'), '[^a-zA-Z0-9]', '', 'g'))
$$;

create or replace function public.create_post(
  _body text, _category_id uuid, _product_ids uuid[], _tags text[],
  _is_review boolean, _rating smallint, _client_key uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pid uuid; t text; norm text; hid uuid; recent int;
begin
  if uid is null then raise exception 'Faça login para publicar'; end if;
  select id into pid from posts where author_id = uid and client_key = _client_key;
  if pid is not null then return pid; end if;
  if _body is null or char_length(btrim(_body)) = 0 then raise exception 'A publicação não pode ficar vazia'; end if;
  if char_length(_body) > 2000 then raise exception 'Máximo de 2000 caracteres'; end if;
  if coalesce(array_length(_tags,1),0) > 8 then raise exception 'Máximo de 8 hashtags'; end if;
  if coalesce(array_length(_product_ids,1),0) > 5 then raise exception 'Máximo de 5 equipamentos'; end if;
  if _is_review and _rating is null then raise exception 'Avaliações precisam de uma nota'; end if;
  select count(*) into recent from posts where author_id = uid and created_at > now() - interval '1 minute';
  if recent >= 5 then raise exception 'Muitas publicações em pouco tempo. Aguarde um minuto.'; end if;
  insert into posts (author_id, body, category_id, is_review, rating, client_key)
  values (uid, btrim(_body), _category_id, coalesce(_is_review,false), case when _is_review then _rating end, _client_key)
  returning id into pid;
  if _product_ids is not null then
    insert into post_products (post_id, product_id) select distinct pid, unnest(_product_ids) on conflict do nothing;
  end if;
  if _tags is not null then
    foreach t in array _tags loop
      norm := normalize_hashtag(t);
      if char_length(norm) between 2 and 30 then
        insert into hashtags (tag, label) values (norm, regexp_replace(t, '[^a-zA-Z0-9À-ÿ]', '', 'g'))
        on conflict (tag) do update set tag = excluded.tag returning id into hid;
        insert into post_hashtags values (pid, hid) on conflict do nothing;
      end if;
    end loop;
  end if;
  return pid;
end $$;
revoke execute on function public.create_post from public, anon;
grant execute on function public.create_post to authenticated;

insert into public.categories (slug, name, sort) values
('gpu','Placas de vídeo',1),('cpu','Processadores',2),('placa-mae','Placas-mãe',3),('memoria','Memória RAM',4),
('armazenamento','Armazenamento',5),('fonte','Fontes',6),('refrigeracao','Refrigeração',7),('gabinete','Gabinetes',8),
('monitor','Monitores',9),('mouse','Mouses',10),('teclado','Teclados',11),('headset','Headsets e áudio',12),
('console','Consoles',13),('celular','Celulares e tablets',14),('rede','Rede',15);

insert into public.manufacturers (slug, name) values
('nvidia','NVIDIA'),('amd','AMD'),('intel','Intel'),('asus','ASUS'),('corsair','Corsair'),('logitech','Logitech'),
('razer','Razer'),('samsung','Samsung'),('sony','Sony'),('microsoft','Microsoft'),('nintendo','Nintendo'),
('apple','Apple'),('xiaomi','Xiaomi'),('lg','LG'),('kingston','Kingston'),('tp-link','TP-Link');

insert into public.products (slug, name, category_id, manufacturer_id, specs)
select v.slug, v.name, c.id, m.id, v.specs::jsonb from (values
('geforce-rtx-4070-super','GeForce RTX 4070 Super','gpu','nvidia','{"VRAM":"12 GB GDDR6X"}'),
('radeon-rx-7800-xt','Radeon RX 7800 XT','gpu','amd','{"VRAM":"16 GB GDDR6"}'),
('ryzen-7-7800x3d','Ryzen 7 7800X3D','cpu','amd','{"Núcleos":"8","Soquete":"AM5"}'),
('core-i5-14600k','Core i5-14600K','cpu','intel','{"Núcleos":"14","Soquete":"LGA1700"}'),
('rog-strix-b650-a','ROG Strix B650-A','placa-mae','asus','{"Formato":"ATX","Soquete":"AM5"}'),
('vengeance-ddr5-32gb','Vengeance DDR5 32 GB','memoria','corsair','{"Velocidade":"6000 MT/s"}'),
('fury-renegade-1tb','Fury Renegade 1 TB NVMe','armazenamento','kingston','{"Interface":"PCIe 4.0"}'),
('990-pro-2tb','990 PRO 2 TB','armazenamento','samsung','{"Interface":"PCIe 4.0"}'),
('rm850x','RM850x','fonte','corsair','{"Potência":"850 W","Certificação":"80+ Gold"}'),
('h150i-elite','iCUE H150i Elite','refrigeracao','corsair','{"Tipo":"Water cooler 360 mm"}'),
('ultragear-27gr95qe','UltraGear 27GR95QE','monitor','lg','{"Painel":"OLED","Taxa":"240 Hz"}'),
('g-pro-x-superlight-2','G Pro X Superlight 2','mouse','logitech','{"Peso":"60 g"}'),
('deathadder-v3','DeathAdder V3','mouse','razer','{"Peso":"59 g"}'),
('huntsman-v3-pro','Huntsman V3 Pro','teclado','razer','{"Switch":"Analógico óptico"}'),
('g915-tkl','G915 TKL','teclado','logitech','{"Conexão":"Sem fio"}'),
('blackshark-v2-pro','BlackShark V2 Pro','headset','razer','{"Conexão":"Sem fio"}'),
('playstation-5','PlayStation 5','console','sony','{}'),
('xbox-series-x','Xbox Series X','console','microsoft','{}'),
('nintendo-switch-oled','Nintendo Switch OLED','console','nintendo','{}'),
('iphone-15-pro','iPhone 15 Pro','celular','apple','{}'),
('galaxy-s24','Galaxy S24','celular','samsung','{}'),
('redmi-note-13','Redmi Note 13','celular','xiaomi','{}'),
('archer-ax55','Archer AX55','rede','tp-link','{"Padrão":"Wi-Fi 6"}')
) as v(slug,name,cat,man,specs)
join public.categories c on c.slug = v.cat join public.manufacturers m on m.slug = v.man;
