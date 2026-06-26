
CREATE TABLE public.lotes_fechados (
  simulado_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  fechado_em timestamptz NOT NULL DEFAULT now(),
  fechado_por uuid,
  PRIMARY KEY (simulado_id, turma_id)
);
GRANT SELECT, INSERT, DELETE ON public.lotes_fechados TO authenticated;
GRANT ALL ON public.lotes_fechados TO service_role;
ALTER TABLE public.lotes_fechados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lotes_fechados_select_authenticated" ON public.lotes_fechados
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lotes_fechados_insert_admin_or_prof_resp" ON public.lotes_fechados
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor_responsavel')
  );
CREATE POLICY "lotes_fechados_delete_admin" ON public.lotes_fechados
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
