-- 1) cronograma: remove anonymous read access
DROP POLICY IF EXISTS "Anon can view cronograma" ON public.cronograma;
REVOKE SELECT ON public.cronograma FROM anon;

-- 2) lotes_fechados: scope reads
DROP POLICY IF EXISTS "lotes_fechados_select_authenticated" ON public.lotes_fechados;
CREATE POLICY "lotes_fechados_select_scoped"
ON public.lotes_fechados FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'superintendente')
  OR EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = lotes_fechados.turma_id
      AND t.school_id = public.get_my_school()
  )
  OR lotes_fechados.turma_id IN (SELECT public.minhas_turmas_ids())
);

-- 3) schools: drop blanket authenticated visibility, keep scoped access
DROP POLICY IF EXISTS "Escolas visiveis para autenticados" ON public.schools;
DROP POLICY IF EXISTS "Prof resp/gestor veem sua escola" ON public.schools;
CREATE POLICY "Escolas visiveis conforme escopo"
ON public.schools FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'superintendente')
  OR id = public.get_my_school()
  OR id IN (
    SELECT t.school_id FROM public.turmas t
    WHERE t.id IN (SELECT public.minhas_turmas_ids())
  )
);