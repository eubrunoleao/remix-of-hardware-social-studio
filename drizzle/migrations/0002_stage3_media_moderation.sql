CREATE TABLE public.post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.post_images TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_images TO authenticated;
GRANT ALL ON public.post_images TO service_role;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read" ON public.post_images FOR SELECT USING (true);
CREATE POLICY "author insert" ON public.post_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
    AND path LIKE auth.uid()::text || '/%');
CREATE POLICY "author delete" ON public.post_images FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

CREATE POLICY "post images read" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
CREATE POLICY "post images upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif'));
CREATE POLICY "post images delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
CREATE POLICY "own or admin read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','ofensivo','enganoso','outro')),
  details text CHECK (char_length(details) <= 500),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','resolvida','rejeitada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamptz,
  UNIQUE (post_id, reporter_id)
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insert" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'aberta');
CREATE POLICY "own or staff read" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.moderation_log TO authenticated;
GRANT ALL ON public.moderation_log TO service_role;
ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read" ON public.moderation_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN false; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'admin');
  INSERT INTO public.moderation_log(actor_id, action, target_type, target_id) VALUES (auth.uid(), 'primeiro_admin', 'usuario', auth.uid());
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.set_user_role(_username text, _role public.app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  SELECT id INTO _uid FROM public.profiles WHERE username = lower(_username);
  IF _uid IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_uid, _role) ON CONFLICT DO NOTHING;
  ELSE
    IF _uid = auth.uid() AND _role = 'admin' THEN RAISE EXCEPTION 'Você não pode remover seu próprio papel de admin'; END IF;
    DELETE FROM public.user_roles WHERE user_id = _uid AND role = _role;
  END IF;
  INSERT INTO public.moderation_log(actor_id, action, target_type, target_id, note)
  VALUES (auth.uid(), CASE WHEN _grant THEN 'conceder_papel' ELSE 'remover_papel' END, 'usuario', _uid, _role::text);
END $$;

CREATE OR REPLACE FUNCTION public.resolve_report(_report_id uuid, _remove_post boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _post uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Apenas moderadores'; END IF;
  SELECT post_id INTO _post FROM public.reports WHERE id = _report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Denúncia não encontrada'; END IF;
  UPDATE public.reports SET status = CASE WHEN _remove_post THEN 'resolvida' ELSE 'rejeitada' END,
    resolved_by = auth.uid(), resolved_at = now()
  WHERE id = _report_id OR (_remove_post AND _post IS NOT NULL AND post_id = _post AND status = 'aberta');
  IF _remove_post AND _post IS NOT NULL THEN
    DELETE FROM public.posts WHERE id = _post;
  END IF;
  INSERT INTO public.moderation_log(actor_id, action, target_type, target_id, note)
  VALUES (auth.uid(), CASE WHEN _remove_post THEN 'remover_post' ELSE 'rejeitar_denuncia' END, 'post', _post, left(_note, 500));
END $$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  DELETE FROM public.post_likes WHERE user_id = _uid;
  DELETE FROM public.post_saves WHERE user_id = _uid;
  DELETE FROM public.user_devices WHERE user_id = _uid;
  DELETE FROM public.reports WHERE reporter_id = _uid;
  UPDATE public.channels SET created_by = NULL WHERE created_by = _uid;
  DELETE FROM storage.objects WHERE bucket_id = 'post-images' AND (storage.foldername(name))[1] = _uid::text;
  DELETE FROM auth.users WHERE id = _uid;
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_user_role(text, public.app_role, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.resolve_report(uuid, boolean, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(text, public.app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_report(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;