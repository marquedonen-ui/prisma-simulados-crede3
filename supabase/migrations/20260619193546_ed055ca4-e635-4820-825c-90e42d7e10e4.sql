
-- Remove legacy 'professor' read policy that exposed resposta_correta
DROP POLICY IF EXISTS "Professor le questoes" ON public.questoes;

-- Restrict column-level SELECT on the sensitive column
REVOKE SELECT ON public.questoes FROM authenticated;
GRANT SELECT (id, simulado_id, numero, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, pontos, ordem, created_at, updated_at)
  ON public.questoes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.questoes TO authenticated;
GRANT ALL ON public.questoes TO service_role;

-- Allow professor_responsavel and gestor to read questoes (resposta_correta still blocked by column grant)
CREATE POLICY "Prof resp e gestor leem questoes"
  ON public.questoes
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'professor_responsavel'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  );
