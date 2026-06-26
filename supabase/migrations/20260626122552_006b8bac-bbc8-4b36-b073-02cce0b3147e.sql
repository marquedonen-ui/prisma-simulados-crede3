-- Restore table privileges on public.questoes so authenticated users (admins via RLS) can save gabaritos.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questoes TO authenticated;
GRANT ALL ON public.questoes TO service_role;

-- Keep resposta_correta hidden from common authenticated reads via column-level revoke,
-- but allow writing it (INSERT/UPDATE) so admins can save the gabarito.
REVOKE SELECT (resposta_correta) ON public.questoes FROM authenticated;
GRANT INSERT (resposta_correta), UPDATE (resposta_correta) ON public.questoes TO authenticated;