-- Initial application schema for Hardware Social Studio.
-- Generated from the application's Supabase types and current repository migrations.
-- Safe for a new/empty public schema; intentionally does not drop existing objects.

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 3 AND 24),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 50),
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  avatar_path text,
  machine_specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT profiles_avatar_owner_path CHECK (avatar_path IS NULL OR avatar_path LIKE id::text || '/%'),
  CONSTRAINT profiles_machine_object CHECK (jsonb_typeof(machine_specs) = 'object')
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id),
  manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  specs_verified boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  client_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_review boolean NOT NULL DEFAULT false,
  rating numeric CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  UNIQUE (author_id, client_key)
);
CREATE TABLE IF NOT EXISTS public.post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL UNIQUE,
  label text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.post_hashtags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.post_saves (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.post_products (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, product_id)
);
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE TABLE IF NOT EXISTS public.mutes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, muted_id),
  CHECK (user_id <> muted_id)
);
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE TABLE IF NOT EXISTS public.channel_follows (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_author_created_idx ON public.posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category_id);
CREATE INDEX IF NOT EXISTS products_manufacturer_idx ON public.products (manufacturer_id);
CREATE INDEX IF NOT EXISTS profiles_machine_specs_gin_idx ON public.profiles USING gin (machine_specs);

-- Enable RLS on every exposed application table.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_follows ENABLE ROW LEVEL SECURITY;

-- Public catalog and profile reads.
CREATE POLICY profiles_public_read ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY profiles_owner_update ON public.profiles FOR UPDATE TO authenticated USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));
CREATE POLICY categories_public_read ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY manufacturers_public_read ON public.manufacturers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY products_public_read ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY channels_public_read ON public.channels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY posts_public_read ON public.posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY post_images_public_read ON public.post_images FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id));
CREATE POLICY hashtags_public_read ON public.hashtags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY post_hashtags_public_read ON public.post_hashtags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY post_likes_public_read ON public.post_likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY post_products_public_read ON public.post_products FOR SELECT TO anon, authenticated USING (true);

-- User-owned writes.
CREATE POLICY posts_owner_insert ON public.posts FOR INSERT TO authenticated WITH CHECK (author_id = (select auth.uid()));
CREATE POLICY posts_owner_update ON public.posts FOR UPDATE TO authenticated USING (author_id = (select auth.uid())) WITH CHECK (author_id = (select auth.uid()));
CREATE POLICY posts_owner_delete ON public.posts FOR DELETE TO authenticated USING (author_id = (select auth.uid()));
CREATE POLICY post_images_owner_insert ON public.post_images FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = (select auth.uid())));
CREATE POLICY post_images_owner_delete ON public.post_images FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = (select auth.uid())));
CREATE POLICY post_likes_owner_insert ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY post_likes_owner_delete ON public.post_likes FOR DELETE TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY post_saves_owner_all ON public.post_saves FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY follows_owner_all ON public.follows FOR ALL TO authenticated USING (follower_id = (select auth.uid())) WITH CHECK (follower_id = (select auth.uid()));
CREATE POLICY blocks_owner_all ON public.blocks FOR ALL TO authenticated USING (blocker_id = (select auth.uid())) WITH CHECK (blocker_id = (select auth.uid()));
CREATE POLICY mutes_owner_all ON public.mutes FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY conversations_member_read ON public.conversations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND cp.user_id = (select auth.uid())));
CREATE POLICY conversation_participants_member_read ON public.conversation_participants FOR SELECT TO authenticated USING (user_id = (select auth.uid()) OR EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_id AND cp.user_id = (select auth.uid())));
CREATE POLICY messages_member_read ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_id AND cp.user_id = (select auth.uid())));
CREATE POLICY messages_member_insert ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = (select auth.uid()) AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_id AND cp.user_id = (select auth.uid())));
CREATE POLICY reports_owner_insert ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = (select auth.uid()));
CREATE POLICY reports_owner_read ON public.reports FOR SELECT TO authenticated USING (reporter_id = (select auth.uid()));
CREATE POLICY user_roles_owner_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY user_devices_owner_all ON public.user_devices FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY channel_follows_owner_all ON public.channel_follows FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- Keep privileged/internal tables unavailable to ordinary users by RLS; grant only what client flows need.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.profiles, public.categories, public.manufacturers, public.products, public.channels, public.posts, public.post_images, public.hashtags, public.post_hashtags, public.post_likes, public.post_products TO anon, authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT INSERT, DELETE ON public.post_images, public.post_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_saves, public.follows, public.blocks, public.mutes, public.user_devices, public.channel_follows TO authenticated;
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT SELECT, INSERT ON public.messages, public.conversation_participants, public.conversations TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Profile search is SECURITY INVOKER so it cannot bypass row-level security.
CREATE OR REPLACE FUNCTION public.search_profiles_by_machine(search_term text)
RETURNS TABLE (id uuid, username text, display_name text, avatar_path text, matched_components text[])
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  WITH term AS (SELECT trim(search_term) AS value),
  entries AS (
    SELECT p.id AS profile_id, p.username, p.display_name, p.avatar_path, item.key, item.value,
      CASE
        WHEN item.key = 'processor' THEN 'Processador'
        WHEN item.key = 'motherboard' THEN 'Placa-mãe'
        WHEN item.key = 'graphics' THEN 'Placa de vídeo (GPU)'
        WHEN item.key = 'storage' THEN 'Armazenamento (SSD / HD)'
        WHEN item.key = 'memory' THEN 'Memória RAM'
        WHEN item.key = 'cooling' THEN 'Refrigeração'
        WHEN item.key = 'case' THEN 'Gabinete'
        WHEN item.key = 'power' THEN 'Fonte de alimentação'
        WHEN item.key = 'fans' THEN 'Ventoinhas e kits de fans'
        WHEN item.key = 'monitor' THEN 'Monitor'
        WHEN item.key = 'mouse' THEN 'Mouse'
        WHEN item.key = 'keyboard' THEN 'Teclado'
        WHEN item.key = 'mousepad' THEN 'Mousepad / deskpad'
        WHEN item.key = 'microphone' THEN 'Microfone'
        WHEN item.key = 'arm' THEN 'Braço articulado'
        WHEN item.key = 'headset' THEN 'Fone de ouvido / headset'
        WHEN item.key = 'name' THEN 'Nome da máquina'
        WHEN item.key = 'system' THEN 'Sistema operacional'
        WHEN item.key = 'other' THEN 'Outras especificações'
        WHEN item.key ~ '^extra_[0-9]+_value$' THEN COALESCE(p.machine_specs ->> regexp_replace(item.key, '_value$', '_label'), 'Componente adicional')
        ELSE item.key
      END AS component_label
    FROM public.profiles p
    CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.machine_specs, '{}'::jsonb)) AS item(key, value)
    WHERE item.key !~ '^extra_[0-9]+_label$'
  ),
  matches AS (
    SELECT e.* FROM entries e CROSS JOIN term t
    WHERE char_length(t.value) >= 2
      AND (e.value ILIKE '%' || t.value || '%' OR e.component_label ILIKE '%' || t.value || '%')
  )
  SELECT m.profile_id, m.username, m.display_name, m.avatar_path,
    array_agg(DISTINCT m.component_label ORDER BY m.component_label)
  FROM matches m
  GROUP BY m.profile_id, m.username, m.display_name, m.avatar_path
  ORDER BY cardinality(array_agg(DISTINCT m.component_label)) DESC, m.display_name ASC
  LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.search_profiles_by_machine(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles_by_machine(text) TO anon, authenticated;

-- Create profile records when a new Auth account is created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE base_username text; candidate text; n integer := 0; metadata jsonb;
BEGIN
  metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  base_username := lower(regexp_replace(COALESCE(metadata->>'username', split_part(COALESCE(NEW.email,''), '@', 1), 'user'), '[^a-zA-Z0-9_]', '', 'g'));
  IF char_length(base_username) < 3 THEN base_username := 'user' || base_username; END IF;
  base_username := left(base_username, 18);
  candidate := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    n := n + 1; candidate := left(base_username, 18 - char_length(n::text)) || n::text;
  END LOOP;
  INSERT INTO public.profiles(id, username, display_name)
  VALUES (NEW.id, candidate, left(COALESCE(NULLIF(metadata->>'display_name',''), NULLIF(metadata->>'full_name',''), candidate), 50))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure profile-photos bucket exists; policies restrict writes to each user's own folder.
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "profile photos read" ON storage.objects;
DROP POLICY IF EXISTS "profile photos own insert" ON storage.objects;
DROP POLICY IF EXISTS "profile photos own delete" ON storage.objects;
CREATE POLICY "profile photos read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'profile-photos');
CREATE POLICY "profile photos own insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = (select auth.uid())::text);
CREATE POLICY "profile photos own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = (select auth.uid())::text);

INSERT INTO public.categories (slug, name, sort) VALUES
  ('monitores','Monitores e displays',100),('mouses','Mouses',101),('teclados','Teclados',102),
  ('mousepads','Mousepads e deskpads',103),('headsets-fones','Headsets e fones',104),('microfones-audio','Microfones e áudio',105),
  ('webcams-cameras','Webcams e câmeras',106),('controles-gamepads','Controles e gamepads',107),('volantes-simuladores','Volantes e simuladores',108),
  ('placas-de-video','Placas de vídeo (GPU)',109),('processadores','Processadores (CPU)',110),('placas-mae','Placas-mãe',111),
  ('memorias-ram','Memórias RAM',112),('armazenamento-interno','Armazenamento interno (SSD e HD)',113),('armazenamento-externo','Armazenamento externo',114),
  ('fontes','Fontes de alimentação',115),('gabinetes','Gabinetes',116),('air-coolers','Air coolers',117),('water-coolers','Water coolers',118),
  ('fans-ventoinhas','Ventoinhas e kits de fans',119),('controladoras-rgb','Controladoras RGB/ARGB e hubs',120),('placas-expansao-captura','Placas de expansão e captura',121),
  ('redes-conectividade','Redes e conectividade',122),('cabos-adaptadores','Cabos e adaptadores',123),('energia-nobreaks','Nobreaks, filtros de linha e energia',124),
  ('computadores-notebooks','Computadores, notebooks e mini PCs',125),('consoles-vr','Consoles e realidade virtual',126),('mesas-cadeiras','Mesas e cadeiras',127),
  ('suportes-organizacao','Suportes e organização do setup',128),('iluminacao-decoracao','Iluminação e decoração do setup',129),('streaming-criacao','Streaming e criação de conteúdo',130),
  ('ferramentas-manutencao','Ferramentas e manutenção',131),('acessorios-diversos','Acessórios e componentes diversos',132)
ON CONFLICT (slug) DO NOTHING;
