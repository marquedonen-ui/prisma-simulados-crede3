
-- Add gabarito_liberado flag to existing diagnostic_assessments (used as "simulados")
ALTER TABLE public.diagnostic_assessments
  ADD COLUMN IF NOT EXISTS gabarito_liberado boolean NOT NULL DEFAULT false;

-- =========================
-- questoes
-- =========================
CREATE TABLE public.questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.diagnostic_assessments(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  enunciado text NOT NULL,
  alternativa_a text NOT NULL,
  alternativa_b text NOT NULL,
  alternativa_c text NOT NULL,
  alternativa_d text NOT NULL,
  alternativa_e text,
  resposta_correta text NOT NULL CHECK (upper(resposta_correta) IN ('A','B','C','D','E')),
  pontos integer NOT NULL DEFAULT 1,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (simulado_id, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.questoes TO authenticated;
GRANT ALL ON public.questoes TO service_role;
ALTER TABLE public.questoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read questoes"
  ON public.questoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and professors manage questoes"
  ON public.questoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'));

CREATE TRIGGER trg_questoes_updated_at
  BEFORE UPDATE ON public.questoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- respostas_alunos
-- =========================
CREATE TABLE public.respostas_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  simulado_id uuid NOT NULL REFERENCES public.diagnostic_assessments(id) ON DELETE CASCADE,
  questao_id uuid NOT NULL REFERENCES public.questoes(id) ON DELETE CASCADE,
  resposta_escolhida text NOT NULL CHECK (upper(resposta_escolhida) IN ('A','B','C','D','E')),
  data_resposta timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, questao_id)
);

CREATE INDEX idx_respostas_alunos_simulado ON public.respostas_alunos(simulado_id);
CREATE INDEX idx_respostas_alunos_usuario ON public.respostas_alunos(usuario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.respostas_alunos TO authenticated;
GRANT ALL ON public.respostas_alunos TO service_role;
ALTER TABLE public.respostas_alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own respostas, professors/admins read all"
  ON public.respostas_alunos FOR SELECT TO authenticated
  USING (
    auth.uid() = usuario_id
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'professor')
  );

CREATE POLICY "Users insert own respostas"
  ON public.respostas_alunos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users update own respostas"
  ON public.respostas_alunos FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Admins manage respostas"
  ON public.respostas_alunos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================
-- resultados_simulados
-- =========================
CREATE TABLE public.resultados_simulados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  simulado_id uuid NOT NULL REFERENCES public.diagnostic_assessments(id) ON DELETE CASCADE,
  pontuacao_obtida integer NOT NULL DEFAULT 0,
  total_questoes integer NOT NULL DEFAULT 0,
  percentual numeric(5,2) NOT NULL DEFAULT 0,
  acertos integer NOT NULL DEFAULT 0,
  data_finalizacao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, simulado_id)
);

CREATE INDEX idx_resultados_simulados_simulado ON public.resultados_simulados(simulado_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resultados_simulados TO authenticated;
GRANT ALL ON public.resultados_simulados TO service_role;
ALTER TABLE public.resultados_simulados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own resultados, professors/admins read all"
  ON public.resultados_simulados FOR SELECT TO authenticated
  USING (
    auth.uid() = usuario_id
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'professor')
  );

CREATE POLICY "Admins and professors manage resultados"
  ON public.resultados_simulados FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'));

CREATE TRIGGER trg_resultados_simulados_updated_at
  BEFORE UPDATE ON public.resultados_simulados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
