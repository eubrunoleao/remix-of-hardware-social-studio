GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
CREATE OR REPLACE FUNCTION public.ensure_my_profile() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE account record; base text; candidate text; n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN RETURN; END IF;
  SELECT email, raw_user_meta_data INTO account FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  base := lower(regexp_replace(coalesce(account.raw_user_meta_data->>'username', split_part(account.email, '@', 1), 'user'), '[^a-zA-Z0-9_]', '', 'g'));
  IF char_length(base) < 3 THEN base := 'user' || base; END IF;
  base := left(base,18); candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP n := n+1; candidate := base || n::text; END LOOP;
  INSERT INTO public.profiles(id,username,display_name) VALUES (auth.uid(),candidate,left(coalesce(nullif(account.raw_user_meta_data->>'display_name',''),nullif(account.raw_user_meta_data->>'full_name',''),candidate),50));
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;