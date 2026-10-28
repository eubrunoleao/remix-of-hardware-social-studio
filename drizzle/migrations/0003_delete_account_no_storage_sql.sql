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
  DELETE FROM auth.users WHERE id = _uid;
END $$;