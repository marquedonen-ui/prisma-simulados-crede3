
-- 1) Tabela de alunos (cadastro offline)
CREATE TABLE public.alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  matricula text NOT NULL,
  nome text NOT NULL,
  turma text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, matricula)
);

CREATE INDEX idx_alunos_school ON public.alunos(school_id);
CREATE INDEX idx_alunos_matricula ON public.alunos(matricula);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alunos TO authenticated;
GRANT ALL ON public.alunos TO service_role;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read alunos"
  ON public.alunos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and professors manage alunos"
  ON public.alunos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'));

CREATE TRIGGER trg_alunos_updated_at
  BEFORE UPDATE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Ajustar respostas_alunos: aceitar aluno offline OU usuário online
ALTER TABLE public.respostas_alunos
  ALTER COLUMN usuario_id DROP NOT NULL;

ALTER TABLE public.respostas_alunos
  ADD COLUMN aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE;

ALTER TABLE public.respostas_alunos
  DROP CONSTRAINT IF EXISTS respostas_alunos_usuario_id_questao_id_key;

ALTER TABLE public.respostas_alunos
  ADD CONSTRAINT respostas_alunos_one_owner
  CHECK ((usuario_id IS NOT NULL)::int + (aluno_id IS NOT NULL)::int = 1);

CREATE UNIQUE INDEX respostas_alunos_aluno_questao_key
  ON public.respostas_alunos (aluno_id, questao_id) WHERE aluno_id IS NOT NULL;

CREATE UNIQUE INDEX respostas_alunos_usuario_questao_key
  ON public.respostas_alunos (usuario_id, questao_id) WHERE usuario_id IS NOT NULL;

CREATE INDEX idx_respostas_alunos_aluno ON public.respostas_alunos(aluno_id);

-- Permitir que professores/admin gerenciem respostas (insercao offline)
CREATE POLICY "Professors and admins manage respostas"
  ON public.respostas_alunos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'));

-- 3) Ajustar resultados_simulados: idem
ALTER TABLE public.resultados_simulados
  ALTER COLUMN usuario_id DROP NOT NULL;

ALTER TABLE public.resultados_simulados
  ADD COLUMN aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE;

ALTER TABLE public.resultados_simulados
  DROP CONSTRAINT IF EXISTS resultados_simulados_usuario_id_simulado_id_key;

ALTER TABLE public.resultados_simulados
  ADD CONSTRAINT resultados_simulados_one_owner
  CHECK ((usuario_id IS NOT NULL)::int + (aluno_id IS NOT NULL)::int = 1);

CREATE UNIQUE INDEX resultados_simulados_aluno_simulado_key
  ON public.resultados_simulados (aluno_id, simulado_id) WHERE aluno_id IS NOT NULL;

CREATE UNIQUE INDEX resultados_simulados_usuario_simulado_key
  ON public.resultados_simulados (usuario_id, simulado_id) WHERE usuario_id IS NOT NULL;

CREATE INDEX idx_resultados_simulados_aluno ON public.resultados_simulados(aluno_id);
