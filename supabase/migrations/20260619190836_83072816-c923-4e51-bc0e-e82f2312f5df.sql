
-- ============ alunos: admin policy ============
DROP POLICY IF EXISTS "Admin gerencia alunos" ON public.alunos;
CREATE POLICY "Admin gerencia alunos"
  ON public.alunos
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ questoes: only admin manages; professor reads ============
DROP POLICY IF EXISTS "Equipe pedagogica gerencia questoes" ON public.questoes;
DROP POLICY IF EXISTS "Professor responsavel gerencia questoes" ON public.questoes;
DROP POLICY IF EXISTS "Admin gerencia questoes" ON public.questoes;
DROP POLICY IF EXISTS "Professor le questoes" ON public.questoes;

CREATE POLICY "Admin gerencia questoes"
  ON public.questoes
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Professor le questoes"
  ON public.questoes
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'professor'::app_role));

-- ============ respostas_alunos: drop broad/insecure policies ============
DROP POLICY IF EXISTS "Prof resp/gestor/admin leem respostas" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Prof resp/admin atualizam respostas" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Prof resp/admin deletam respostas" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Prof resp/admin inserem respostas" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Prof/admin importam respostas offline" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Prof/admin leem respostas offline" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Prof/admin removem respostas offline da turma" ON public.respostas_alunos;

-- Helper predicate: row belongs to the user's school
-- For online rows: via alunos.school_id; for offline rows: via turmas.school_id.

-- INSERT (online, individual aluno)
CREATE POLICY "Prof resp insere respostas da sua escola"
  ON public.respostas_alunos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'professor_responsavel'::app_role)
    AND aluno_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.alunos a
      WHERE a.id = respostas_alunos.aluno_id
        AND a.school_id = get_my_school()
    )
  );

-- INSERT (offline, by turma) — school-scoped via turmas
CREATE POLICY "Prof/admin importam respostas offline da sua escola"
  ON public.respostas_alunos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    turma_id IS NOT NULL
    AND numero_chamada IS NOT NULL
    AND aluno_id IS NULL
    AND usuario_id IS NULL
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        (has_role(auth.uid(), 'professor'::app_role)
         OR has_role(auth.uid(), 'professor_responsavel'::app_role))
        AND EXISTS (
          SELECT 1 FROM public.turmas t
          WHERE t.id = respostas_alunos.turma_id
            AND t.school_id = get_my_school()
        )
      )
    )
  );

-- SELECT (offline, by turma) — scoped by school for non-admins
CREATE POLICY "Prof/gestor leem respostas offline da sua escola"
  ON public.respostas_alunos
  FOR SELECT
  TO authenticated
  USING (
    turma_id IS NOT NULL
    AND (has_role(auth.uid(), 'professor'::app_role)
         OR has_role(auth.uid(), 'professor_responsavel'::app_role)
         OR has_role(auth.uid(), 'gestor'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.turmas t
      WHERE t.id = respostas_alunos.turma_id
        AND t.school_id = get_my_school()
    )
  );

-- UPDATE — school-scoped (online via aluno, offline via turma)
CREATE POLICY "Prof resp atualiza respostas da sua escola"
  ON public.respostas_alunos
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'professor_responsavel'::app_role)
    AND (
      (aluno_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.alunos a
        WHERE a.id = respostas_alunos.aluno_id AND a.school_id = get_my_school()
      ))
      OR
      (turma_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.turmas t
        WHERE t.id = respostas_alunos.turma_id AND t.school_id = get_my_school()
      ))
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'professor_responsavel'::app_role)
    AND (
      (aluno_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.alunos a
        WHERE a.id = respostas_alunos.aluno_id AND a.school_id = get_my_school()
      ))
      OR
      (turma_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.turmas t
        WHERE t.id = respostas_alunos.turma_id AND t.school_id = get_my_school()
      ))
    )
  );

-- DELETE — school-scoped
CREATE POLICY "Prof resp deleta respostas da sua escola"
  ON public.respostas_alunos
  FOR DELETE
  TO authenticated
  USING (
    (has_role(auth.uid(), 'professor_responsavel'::app_role)
     OR has_role(auth.uid(), 'professor'::app_role))
    AND (
      (aluno_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.alunos a
        WHERE a.id = respostas_alunos.aluno_id AND a.school_id = get_my_school()
      ))
      OR
      (turma_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.turmas t
        WHERE t.id = respostas_alunos.turma_id AND t.school_id = get_my_school()
      ))
    )
  );
