
-- 1) questoes: rename/replace policy to make intent explicit; gabarito bloqueado via GRANT de coluna
DROP POLICY IF EXISTS "Prof e gestor leem questoes sem gabarito" ON public.questoes;

CREATE POLICY "Prof resp e gestor leem questoes (gabarito bloqueado por GRANT)"
  ON public.questoes
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'professor_responsavel'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  );

-- Defense-in-depth: explicit view that never exposes resposta_correta.
-- security_invoker=on garante que RLS da tabela base se aplica como o chamador.
DROP VIEW IF EXISTS public.questoes_sem_gabarito;
CREATE VIEW public.questoes_sem_gabarito
WITH (security_invoker = on) AS
SELECT
  id,
  simulado_id,
  numero,
  enunciado,
  alternativa_a,
  alternativa_b,
  alternativa_c,
  alternativa_d,
  alternativa_e,
  pontos,
  ordem,
  created_at,
  updated_at
FROM public.questoes;

GRANT SELECT ON public.questoes_sem_gabarito TO authenticated;
GRANT SELECT ON public.questoes_sem_gabarito TO service_role;

-- Garante que a coluna sensível segue restrita ao service_role no Data API
REVOKE SELECT (resposta_correta) ON public.questoes FROM authenticated;
REVOKE SELECT (resposta_correta) ON public.questoes FROM anon;

-- 2) respostas_alunos: remover papel legado 'professor' do DELETE
DROP POLICY IF EXISTS "Prof resp deleta respostas da sua escola" ON public.respostas_alunos;

CREATE POLICY "Prof resp deleta respostas da sua escola"
  ON public.respostas_alunos
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'professor_responsavel'::app_role)
    AND (
      (
        aluno_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.alunos a
          WHERE a.id = respostas_alunos.aluno_id
            AND a.school_id = get_my_school()
        )
      )
      OR (
        turma_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.turmas t
          WHERE t.id = respostas_alunos.turma_id
            AND t.school_id = get_my_school()
        )
      )
    )
  );
