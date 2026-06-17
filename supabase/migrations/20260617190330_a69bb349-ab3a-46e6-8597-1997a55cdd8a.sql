CREATE TABLE public.diagnostic_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  exam_pdf_path TEXT,
  answer_sheet_pdf_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_assessments TO authenticated;
GRANT ALL ON public.diagnostic_assessments TO service_role;

ALTER TABLE public.diagnostic_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read diagnostic assessments"
  ON public.diagnostic_assessments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage diagnostic assessments"
  ON public.diagnostic_assessments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_diagnostic_assessments_updated_at
  BEFORE UPDATE ON public.diagnostic_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();