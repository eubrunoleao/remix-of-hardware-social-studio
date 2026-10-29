ALTER TABLE public.profiles ADD COLUMN avatar_path text;
ALTER TABLE public.profiles ADD COLUMN machine_specs jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_owner_path CHECK (avatar_path IS NULL OR avatar_path LIKE id::text || '/%');
ALTER TABLE public.profiles ADD CONSTRAINT profiles_machine_object CHECK (jsonb_typeof(machine_specs) = 'object');
CREATE POLICY "profile photos read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'profile-photos');
CREATE POLICY "profile photos own insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "profile photos own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);