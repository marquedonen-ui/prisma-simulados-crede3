
CREATE TABLE public.support_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer text NOT NULL,
  grade text NOT NULL,
  answer_key_pdf_path text,
  commented_test_pdf_path text,
  support_material_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_materials TO authenticated;
GRANT ALL ON public.support_materials TO service_role;

ALTER TABLE public.support_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read support materials"
  ON public.support_materials FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage support materials"
  ON public.support_materials FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_support_materials_updated_at
  BEFORE UPDATE ON public.support_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
