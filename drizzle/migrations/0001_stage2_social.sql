-- Etapa 2: canais, seguir/silenciar/bloquear, mensagens privadas

-- Canais (comunidades temáticas)
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  description text CHECK (char_length(description) <= 280),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.channels TO anon, authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read" ON public.channels FOR SELECT USING (true);

-- Seguir pessoas
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
GRANT SELECT ON public.follows TO anon, authenticated;
GRANT INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read" ON public.follows FOR SELECT USING (true);
CREATE POLICY "own insert" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "own delete" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- Seguir canais
CREATE TABLE public.channel_follows (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);
GRANT SELECT ON public.channel_follows TO anon, authenticated;
GRANT INSERT, DELETE ON public.channel_follows TO authenticated;
GRANT ALL ON public.channel_follows TO service_role;
ALTER TABLE public.channel_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read" ON public.channel_follows FOR SELECT USING (true);
CREATE POLICY "own insert" ON public.channel_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.channel_follows FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Silenciar pessoas (só o dono vê)
CREATE TABLE public.mutes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, muted_id),
  CHECK (user_id <> muted_id)
);
GRANT SELECT, INSERT, DELETE ON public.mutes TO authenticated;
GRANT ALL ON public.mutes TO service_role;
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read" ON public.mutes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.mutes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.mutes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Bloquear pessoas (impede mensagens nos dois sentidos)
CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own read" ON public.blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "own insert" ON public.blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "own delete" ON public.blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- Publicações podem pertencer a um canal
ALTER TABLE public.posts ADD COLUMN channel_id uuid REFERENCES public.channels(id);
CREATE INDEX posts_channel_idx ON public.posts (channel_id) WHERE channel_id IS NOT NULL;

-- Conversas privadas (1:1), com pedido de conversa para desconhecidos
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

CREATE POLICY "member read" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));
CREATE POLICY "member read" ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);
GRANT SELECT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member read" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Canais iniciais
INSERT INTO public.channels (slug, name, description) VALUES
  ('setup-do-mes', 'Setup do Mês', 'Mostre sua máquina e vote nos setups mais criativos da comunidade.'),
  ('custo-beneficio', 'Custo-Benefício', 'Achados, promoções e equipamentos que valem cada centavo.'),
  ('ajuda-tecnica', 'Ajuda Técnica', 'Dúvidas de montagem, compatibilidade e diagnóstico de problemas.'),
  ('games-e-consoles', 'Games e Consoles', 'Tudo sobre consoles, jogos e periféricos para jogar.');

-- Criar canal (qualquer usuário logado)
CREATE OR REPLACE FUNCTION public.create_channel(_slug text, _name text, _description text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO public.channels (slug, name, description, created_by)
  VALUES (lower(trim(_slug)), trim(_name), nullif(trim(_description), ''), auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Iniciar conversa (pedido) com outra pessoa; bloqueios impedem nos dois sentidos
CREATE OR REPLACE FUNCTION public.create_conversation(_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _other_user = auth.uid() THEN RAISE EXCEPTION 'cannot message yourself'; END IF;
  IF EXISTS (SELECT 1 FROM public.blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = _other_user)
       OR (blocker_id = _other_user AND blocked_id = auth.uid())) THEN
    RAISE EXCEPTION 'conversation not allowed';
  END IF;
  SELECT c.id INTO _id FROM public.conversations c
  WHERE EXISTS (SELECT 1 FROM public.conversation_participants p WHERE p.conversation_id = c.id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.conversation_participants p WHERE p.conversation_id = c.id AND p.user_id = _other_user)
  LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.conversations (requester_id) VALUES (auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (_id, auth.uid()), (_id, _other_user);
  RETURN _id;
END;
$$;

-- Aceitar ou recusar pedido de conversa (só o destinatário)
CREATE OR REPLACE FUNCTION public.respond_conversation(_conversation_id uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND c.requester_id <> auth.uid()
      AND public.is_conversation_member(c.id, auth.uid())) THEN
    RAISE EXCEPTION 'not the recipient';
  END IF;
  IF _accept THEN
    UPDATE public.conversations SET accepted = true WHERE id = _conversation_id;
  ELSE
    DELETE FROM public.conversations WHERE id = _conversation_id;
  END IF;
END;
$$;

-- Enviar mensagem: enquanto o pedido não é aceito, só o remetente fala (máx. 3)
CREATE OR REPLACE FUNCTION public.send_message(_conversation_id uuid, _body text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _conv public.conversations%ROWTYPE;
DECLARE _other uuid;
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _conv FROM public.conversations WHERE id = _conversation_id;
  IF NOT FOUND OR NOT public.is_conversation_member(_conversation_id, auth.uid()) THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;
  SELECT user_id INTO _other FROM public.conversation_participants
  WHERE conversation_id = _conversation_id AND user_id <> auth.uid();
  IF EXISTS (SELECT 1 FROM public.blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = _other)
       OR (blocker_id = _other AND blocked_id = auth.uid())) THEN
    RAISE EXCEPTION 'conversation not allowed';
  END IF;
  IF NOT _conv.accepted THEN
    IF _conv.requester_id <> auth.uid() THEN
      RAISE EXCEPTION 'accept the request first';
    END IF;
    IF (SELECT count(*) FROM public.messages WHERE conversation_id = _conversation_id) >= 3 THEN
      RAISE EXCEPTION 'request message limit reached';
    END IF;
  END IF;
  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (_conversation_id, auth.uid(), trim(_body)) RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- create_post passa a aceitar canal opcional
CREATE OR REPLACE FUNCTION public.create_post(
  _body text, _category_id uuid, _product_ids uuid[], _tags text[],
  _is_review boolean, _rating smallint, _client_key uuid, _channel_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
DECLARE _tag text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF char_length(trim(_body)) = 0 OR char_length(_body) > 2000 THEN RAISE EXCEPTION 'invalid body'; END IF;
  IF _is_review AND (_rating IS NULL OR _rating < 1 OR _rating > 5) THEN RAISE EXCEPTION 'invalid rating'; END IF;
  SELECT id INTO _id FROM public.posts WHERE client_key = _client_key AND author_id = auth.uid();
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.posts (author_id, body, category_id, channel_id, is_review, rating, client_key)
  VALUES (auth.uid(), trim(_body), _category_id, _channel_id, _is_review, CASE WHEN _is_review THEN _rating END, _client_key)
  RETURNING id INTO _id;
  IF _product_ids IS NOT NULL THEN
    INSERT INTO public.post_products (post_id, product_id)
    SELECT _id, p FROM unnest(_product_ids) AS p;
  END IF;
  IF _tags IS NOT NULL THEN
    FOREACH _tag IN ARRAY _tags LOOP
      _tag := public.normalize_hashtag(_tag);
      IF char_length(_tag) BETWEEN 2 AND 30 THEN
        INSERT INTO public.hashtags (tag, label) VALUES (_tag, trim(_tag)) ON CONFLICT (tag) DO NOTHING;
        INSERT INTO public.post_hashtags (post_id, hashtag_id)
        SELECT _id, id FROM public.hashtags WHERE tag = _tag;
      END IF;
    END LOOP;
  END IF;
  RETURN _id;
END;
$$;

-- Mensagens em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;