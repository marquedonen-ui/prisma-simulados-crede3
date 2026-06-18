-- Replace policies that still grant the legacy 'professor' role on respostas_alunos
DROP POLICY IF EXISTS "Professores podem inserir respostas anônimas" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Professores podem ler respostas anônimas" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Professores podem atualizar respostas anônimas" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Professores podem deletar respostas anônimas" ON public.respostas_alunos;

CREATE POLICY "Prof resp/admin inserem respostas"
  ON public.respostas_alunos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'professor_responsavel'::app_role)
  );

CREATE POLICY "Prof resp/gestor/admin leem respostas"
  ON public.respostas_alunos
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'professor_responsavel'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  );

CREATE POLICY "Prof resp/admin atualizam respostas"
  ON public.respostas_alunos
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'professor_responsavel'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'professor_responsavel'::app_role)
  );

CREATE POLICY "Prof resp/admin deletam respostas"
  ON public.respostas_alunos
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'professor_responsavel'::app_role)
  );

-- Remove user-scoped self-read on resultados_simulados (no active app feature uses it;
-- students use the student_codes flow without auth, so usuario_id is unset for them).
DROP POLICY IF EXISTS "Usuario le seus proprios resultados" ON public.resultados_simulados;
DROP POLICY IF EXISTS "Usuario le suas proprias respostas" ON public.respostas_alunos;