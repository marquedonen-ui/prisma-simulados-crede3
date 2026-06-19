
-- Permitir respostas anônimas vinculadas a turma+numero_chamada (importação offline),
-- mantendo a regra de "um único dono" para os modos antigos (usuario_id OU aluno_id).
ALTER TABLE public.respostas_alunos
  DROP CONSTRAINT IF EXISTS respostas_alunos_one_owner;

ALTER TABLE public.respostas_alunos
  ADD CONSTRAINT respostas_alunos_owner_chk CHECK (
    -- exatamente um dos três modos:
    (
      (CASE WHEN usuario_id IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN aluno_id   IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN turma_id IS NOT NULL AND numero_chamada IS NOT NULL THEN 1 ELSE 0 END)
    ) = 1
  );

-- Política de INSERT para o modo offline anônimo (admin já era coberto pela policy "Admins manage respostas").
DROP POLICY IF EXISTS "Prof/admin importam respostas offline" ON public.respostas_alunos;
CREATE POLICY "Prof/admin importam respostas offline"
  ON public.respostas_alunos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    turma_id IS NOT NULL
    AND numero_chamada IS NOT NULL
    AND aluno_id IS NULL
    AND usuario_id IS NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'professor')
      OR public.has_role(auth.uid(), 'professor_responsavel')
    )
  );

-- Política de DELETE para permitir reimportação idempotente (a função limpa antes de inserir).
DROP POLICY IF EXISTS "Prof/admin removem respostas offline da turma" ON public.respostas_alunos;
CREATE POLICY "Prof/admin removem respostas offline da turma"
  ON public.respostas_alunos
  FOR DELETE
  TO authenticated
  USING (
    turma_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'professor')
      OR public.has_role(auth.uid(), 'professor_responsavel')
    )
  );

-- Política de SELECT para que professores/admin leiam respostas anônimas (necessária para relatórios).
DROP POLICY IF EXISTS "Prof/admin leem respostas offline" ON public.respostas_alunos;
CREATE POLICY "Prof/admin leem respostas offline"
  ON public.respostas_alunos
  FOR SELECT
  TO authenticated
  USING (
    turma_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'professor')
      OR public.has_role(auth.uid(), 'professor_responsavel')
      OR public.has_role(auth.uid(), 'gestor')
    )
  );
