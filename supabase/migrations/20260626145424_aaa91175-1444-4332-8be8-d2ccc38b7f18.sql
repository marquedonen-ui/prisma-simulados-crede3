-- Close table-level SELECT bypass on questoes so that resposta_correta is not readable.
-- Column-level SELECT grants on safe columns (already in place) become the only path.
REVOKE SELECT ON public.questoes FROM authenticated;
REVOKE SELECT ON public.questoes FROM anon;

-- Ensure safe column SELECT remains available to authenticated (idempotent).
GRANT SELECT (id, simulado_id, numero, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, pontos, ordem, anulada, created_at, updated_at) ON public.questoes TO authenticated;

-- service_role keeps full access (for server-side gabarito reads).
GRANT SELECT ON public.questoes TO service_role;