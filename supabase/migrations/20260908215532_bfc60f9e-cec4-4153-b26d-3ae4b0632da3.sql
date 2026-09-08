
CREATE INDEX IF NOT EXISTS idx_respostas_sim_turma_chamada
  ON public.respostas_alunos (simulado_id, turma_id, numero_chamada);

CREATE OR REPLACE FUNCTION public.rel_alunos_agg(p_simulado uuid, p_disciplina text DEFAULT NULL)
RETURNS TABLE (turma_id uuid, numero_chamada int, nome text, acertos int, respondidas int, total_questoes int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT id, upper(btrim(coalesce(resposta_correta,''))) AS rc, coalesce(anulada,false) AS an
    FROM public.questoes
    WHERE simulado_id = p_simulado
      AND (p_disciplina IS NULL OR btrim(coalesce(disciplina,'')) = btrim(p_disciplina))
  ), tot AS (SELECT count(*)::int AS n FROM q)
  SELECT r.turma_id,
         r.numero_chamada,
         max(r.nome) AS nome,
         count(*) FILTER (
           WHERE upper(btrim(coalesce(r.resposta_escolhida,''))) IN ('A','B','C','D','E')
             AND (q.an OR upper(btrim(coalesce(r.resposta_escolhida,''))) = q.rc)
         )::int AS acertos,
         count(*) FILTER (
           WHERE upper(btrim(coalesce(r.resposta_escolhida,''))) IN ('A','B','C','D','E')
         )::int AS respondidas,
         (SELECT n FROM tot) AS total_questoes
  FROM public.respostas_alunos r
  JOIN q ON q.id = r.questao_id
  WHERE r.simulado_id = p_simulado
    AND r.turma_id IS NOT NULL
    AND r.numero_chamada IS NOT NULL
  GROUP BY r.turma_id, r.numero_chamada;
$$;

CREATE OR REPLACE FUNCTION public.rel_questoes_agg(p_simulado uuid, p_turma uuid DEFAULT NULL, p_escola uuid DEFAULT NULL)
RETURNS TABLE (questao_id uuid, acertos int, erros int, brancos int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT id, upper(btrim(coalesce(resposta_correta,''))) AS rc, coalesce(anulada,false) AS an
    FROM public.questoes WHERE simulado_id = p_simulado
  )
  SELECT q.id AS questao_id,
         count(*) FILTER (
           WHERE upper(btrim(coalesce(r.resposta_escolhida,''))) IN ('A','B','C','D','E')
             AND (q.an OR upper(btrim(coalesce(r.resposta_escolhida,''))) = q.rc)
         )::int AS acertos,
         count(*) FILTER (
           WHERE upper(btrim(coalesce(r.resposta_escolhida,''))) IN ('A','B','C','D','E')
             AND NOT q.an
             AND upper(btrim(coalesce(r.resposta_escolhida,''))) <> q.rc
         )::int AS erros,
         count(*) FILTER (
           WHERE upper(btrim(coalesce(r.resposta_escolhida,''))) NOT IN ('A','B','C','D','E')
         )::int AS brancos
  FROM q
  LEFT JOIN public.respostas_alunos r
    ON r.questao_id = q.id
   AND r.simulado_id = p_simulado
   AND r.turma_id IS NOT NULL
   AND (p_turma IS NULL OR r.turma_id = p_turma)
   AND (p_escola IS NULL OR r.turma_id IN (SELECT t.id FROM public.turmas t WHERE t.school_id = p_escola))
  GROUP BY q.id;
$$;

CREATE OR REPLACE FUNCTION public.rel_importacoes_agg()
RETURNS TABLE (simulado_id uuid, turma_id uuid, respostas int, alunos int, ultima timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.simulado_id,
         r.turma_id,
         count(*)::int AS respostas,
         count(DISTINCT r.numero_chamada)::int AS alunos,
         max(r.data_resposta) AS ultima
  FROM public.respostas_alunos r
  WHERE r.turma_id IS NOT NULL
  GROUP BY r.simulado_id, r.turma_id;
$$;

CREATE OR REPLACE FUNCTION public.rel_simulados_resumo()
RETURNS TABLE (simulado_id uuid, total_respostas int, alunos_distintos int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.simulado_id,
         count(*)::int AS total_respostas,
         count(DISTINCT (r.turma_id::text || '|' || coalesce(r.numero_chamada::text,'')))::int AS alunos_distintos
  FROM public.respostas_alunos r
  WHERE r.turma_id IS NOT NULL
  GROUP BY r.simulado_id;
$$;

REVOKE ALL ON FUNCTION public.rel_alunos_agg(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rel_questoes_agg(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rel_importacoes_agg() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rel_simulados_resumo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rel_alunos_agg(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rel_questoes_agg(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rel_importacoes_agg() TO service_role;
GRANT EXECUTE ON FUNCTION public.rel_simulados_resumo() TO service_role;
