-- Re-grant column-level SELECT on resposta_correta so admin's SELECT * works in the gabarito editor.
GRANT SELECT (resposta_correta) ON public.questoes TO authenticated;

-- Tighten row-level: prof_responsavel/gestor still read questoes (already covered by existing policy),
-- but resposta_correta exposure is governed by application-side projection.
-- (Admin SELECT continues to work via the "Admin gerencia questoes" FOR ALL policy.)