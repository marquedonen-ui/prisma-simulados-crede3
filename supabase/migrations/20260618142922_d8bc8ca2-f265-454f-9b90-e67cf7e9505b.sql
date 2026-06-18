
-- Vínculo escola no perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_school ON public.profiles(school_id);

-- Função: escola do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_school()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Enum de turno
DO $$ BEGIN
  CREATE TYPE public.turno_turma AS ENUM ('manha', 'tarde', 'noite', 'integral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela turmas
CREATE TABLE IF NOT EXISTS public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ano text NOT NULL,
  turno public.turno_turma NOT NULL DEFAULT 'manha',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, nome, ano, turno)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.turmas TO authenticated;
GRANT ALL ON public.turmas TO service_role;

ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam todas as turmas"
  ON public.turmas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Professor responsavel gerencia turmas da sua escola"
  ON public.turmas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'professor_responsavel') AND school_id = public.get_my_school())
  WITH CHECK (public.has_role(auth.uid(), 'professor_responsavel') AND school_id = public.get_my_school());

CREATE POLICY "Gestor visualiza turmas da sua escola"
  ON public.turmas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor') AND school_id = public.get_my_school());

CREATE TRIGGER trg_turmas_updated_at
  BEFORE UPDATE ON public.turmas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Aluno -> turma
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alunos_turma ON public.alunos(turma_id);

-- RLS alunos (escopo por escola)
DROP POLICY IF EXISTS "Professor responsavel gerencia alunos da sua escola" ON public.alunos;
DROP POLICY IF EXISTS "Gestor visualiza alunos da sua escola" ON public.alunos;

CREATE POLICY "Professor responsavel gerencia alunos da sua escola"
  ON public.alunos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'professor_responsavel') AND school_id = public.get_my_school())
  WITH CHECK (public.has_role(auth.uid(), 'professor_responsavel') AND school_id = public.get_my_school());

CREATE POLICY "Gestor visualiza alunos da sua escola"
  ON public.alunos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor') AND school_id = public.get_my_school());

-- Questões (gabarito): prof_resp gerencia, gestor lê
DROP POLICY IF EXISTS "Professor responsavel gerencia questoes" ON public.questoes;
DROP POLICY IF EXISTS "Gestor visualiza questoes" ON public.questoes;

CREATE POLICY "Professor responsavel gerencia questoes"
  ON public.questoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'professor_responsavel'))
  WITH CHECK (public.has_role(auth.uid(), 'professor_responsavel'));

CREATE POLICY "Gestor visualiza questoes"
  ON public.questoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'));

-- Resultados / respostas: por escola
DROP POLICY IF EXISTS "Prof resp/gestor visualizam resultados da sua escola" ON public.resultados_simulados;
CREATE POLICY "Prof resp/gestor visualizam resultados da sua escola"
  ON public.resultados_simulados FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'professor_responsavel') OR public.has_role(auth.uid(), 'gestor'))
    AND aluno_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND a.school_id = public.get_my_school())
  );

DROP POLICY IF EXISTS "Prof resp/gestor visualizam respostas da sua escola" ON public.respostas_alunos;
CREATE POLICY "Prof resp/gestor visualizam respostas da sua escola"
  ON public.respostas_alunos FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'professor_responsavel') OR public.has_role(auth.uid(), 'gestor'))
    AND aluno_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND a.school_id = public.get_my_school())
  );

DROP POLICY IF EXISTS "Prof resp insere respostas offline" ON public.respostas_alunos;
CREATE POLICY "Prof resp insere respostas offline"
  ON public.respostas_alunos FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'professor_responsavel')
    AND aluno_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND a.school_id = public.get_my_school())
  );

DROP POLICY IF EXISTS "Prof resp insere resultados offline" ON public.resultados_simulados;
CREATE POLICY "Prof resp insere resultados offline"
  ON public.resultados_simulados FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'professor_responsavel')
    AND aluno_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND a.school_id = public.get_my_school())
  );

-- Schools: prof_resp/gestor enxergam só sua escola
DROP POLICY IF EXISTS "Prof resp/gestor veem sua escola" ON public.schools;
CREATE POLICY "Prof resp/gestor veem sua escola"
  ON public.schools FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR id = public.get_my_school()
  );
