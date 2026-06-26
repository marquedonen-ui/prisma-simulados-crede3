
-- 1) questoes: substituir política ALL do admin por políticas separadas
DROP POLICY IF EXISTS "Admin gerencia questoes" ON public.questoes;

CREATE POLICY "Admin le questoes"
  ON public.questoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin cria questoes"
  ON public.questoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin edita questoes"
  ON public.questoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin exclui questoes"
  ON public.questoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Permite que professores/gestores leiam linhas (sem o gabarito, via GRANT abaixo)
CREATE POLICY "Prof e gestor leem questoes sem gabarito"
  ON public.questoes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'professor')
    OR public.has_role(auth.uid(), 'professor_responsavel')
    OR public.has_role(auth.uid(), 'gestor')
  );

-- 2) Bloqueia leitura da coluna resposta_correta pelos roles do PostgREST.
--    Apenas service_role (servidor) consegue ler. Admin lê via server function.
REVOKE SELECT (resposta_correta) ON public.questoes FROM authenticated;
REVOKE SELECT (resposta_correta) ON public.questoes FROM anon;
GRANT SELECT (resposta_correta) ON public.questoes TO service_role;

-- Mantém escrita do gabarito para authenticated (RLS restringe a admin)
GRANT INSERT (resposta_correta), UPDATE (resposta_correta) ON public.questoes TO authenticated;

-- 3) respostas_alunos: remover papel legado 'professor' da política de import offline
DROP POLICY IF EXISTS "Prof/admin importam respostas offline da sua escola" ON public.respostas_alunos;

CREATE POLICY "Admin e prof resp importam respostas offline da sua escola"
  ON public.respostas_alunos FOR INSERT TO authenticated
  WITH CHECK (
    turma_id IS NOT NULL
    AND numero_chamada IS NOT NULL
    AND aluno_id IS NULL
    AND usuario_id IS NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        public.has_role(auth.uid(), 'professor_responsavel')
        AND EXISTS (
          SELECT 1 FROM public.turmas t
          WHERE t.id = respostas_alunos.turma_id
            AND t.school_id = public.get_my_school()
        )
      )
    )
  );
