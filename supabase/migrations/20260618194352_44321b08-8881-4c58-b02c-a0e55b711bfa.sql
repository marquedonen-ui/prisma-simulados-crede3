-- 1. Drop legacy "professor" role policies (no school scoping)
DROP POLICY IF EXISTS "Admins and professors manage questoes" ON public.questoes;
DROP POLICY IF EXISTS "Admins and professors manage alunos" ON public.alunos;

-- 2. Remove self-insert/self-update gap on respostas_alunos: any authenticated user
--    could insert a row for an arbitrary aluno_id by setting usuario_id = auth.uid().
DROP POLICY IF EXISTS "Users insert own respostas" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Users update own respostas" ON public.respostas_alunos;

-- 3. Restrict answer-key visibility: gestores see aggregated reports via server
--    functions; they don't need direct read access to resposta_correta.
DROP POLICY IF EXISTS "Gestor visualiza questoes" ON public.questoes;