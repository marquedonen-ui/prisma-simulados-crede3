
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS matricula_atual int;

ALTER TABLE public.respostas_alunos ADD COLUMN IF NOT EXISTS turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE;
ALTER TABLE public.respostas_alunos ADD COLUMN IF NOT EXISTS numero_chamada int;
ALTER TABLE public.respostas_alunos ALTER COLUMN aluno_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS respostas_alunos_anon_unique
  ON public.respostas_alunos (simulado_id, turma_id, numero_chamada, questao_id)
  WHERE turma_id IS NOT NULL AND numero_chamada IS NOT NULL;

CREATE INDEX IF NOT EXISTS respostas_alunos_turma_idx ON public.respostas_alunos(turma_id);

DROP POLICY IF EXISTS "Professores podem inserir respostas anônimas" ON public.respostas_alunos;
CREATE POLICY "Professores podem inserir respostas anônimas"
  ON public.respostas_alunos FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'professor')
     OR public.has_role(auth.uid(), 'professor_responsavel'))
  );

DROP POLICY IF EXISTS "Professores podem ler respostas anônimas" ON public.respostas_alunos;
CREATE POLICY "Professores podem ler respostas anônimas"
  ON public.respostas_alunos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'professor')
    OR public.has_role(auth.uid(), 'professor_responsavel')
    OR public.has_role(auth.uid(), 'gestor')
  );

DROP POLICY IF EXISTS "Professores podem atualizar respostas anônimas" ON public.respostas_alunos;
CREATE POLICY "Professores podem atualizar respostas anônimas"
  ON public.respostas_alunos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor') OR public.has_role(auth.uid(), 'professor_responsavel'));

DROP POLICY IF EXISTS "Professores podem deletar respostas anônimas" ON public.respostas_alunos;
CREATE POLICY "Professores podem deletar respostas anônimas"
  ON public.respostas_alunos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor') OR public.has_role(auth.uid(), 'professor_responsavel'));
