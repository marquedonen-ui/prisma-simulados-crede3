
CREATE POLICY "Auth read support-materials"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-materials');

CREATE POLICY "Admin insert support-materials"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-materials' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update support-materials"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'support-materials' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete support-materials"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'support-materials' AND has_role(auth.uid(), 'admin'::app_role));
