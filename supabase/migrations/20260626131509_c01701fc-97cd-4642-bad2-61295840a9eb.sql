
REVOKE SELECT (resposta_correta) ON public.questoes FROM authenticated;
REVOKE SELECT (resposta_correta) ON public.questoes FROM anon;

GRANT SELECT (id, simulado_id, numero, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, pontos, ordem, created_at, updated_at) ON public.questoes TO authenticated;

DROP POLICY IF EXISTS "Prof/gestor leem respostas offline da sua escola" ON public.respostas_alunos;
CREATE POLICY "Prof resp/gestor leem respostas offline da sua escola"
ON public.respostas_alunos
FOR SELECT
TO authenticated
USING (
  turma_id IS NOT NULL
  AND (
    has_role(auth.uid(), 'professor_responsavel'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  )
  AND EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = respostas_alunos.turma_id
      AND t.school_id = get_my_school()
  )
);
