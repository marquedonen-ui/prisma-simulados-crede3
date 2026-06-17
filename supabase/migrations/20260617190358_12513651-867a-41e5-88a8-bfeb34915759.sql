CREATE POLICY "Authenticated read diagnostic files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'diagnostic-assessments');

CREATE POLICY "Admins upload diagnostic files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'diagnostic-assessments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update diagnostic files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'diagnostic-assessments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete diagnostic files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'diagnostic-assessments' AND public.has_role(auth.uid(), 'admin'));