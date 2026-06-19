GRANT SELECT, INSERT, UPDATE, DELETE ON public.respostas_alunos TO authenticated;
GRANT ALL ON public.respostas_alunos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_assessments TO authenticated;
GRANT ALL ON public.diagnostic_assessments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.turmas TO authenticated;
GRANT ALL ON public.turmas TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;