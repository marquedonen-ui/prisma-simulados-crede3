GRANT SELECT, INSERT, UPDATE, DELETE ON public.questoes TO authenticated;
GRANT ALL ON public.questoes TO service_role;

DROP POLICY IF EXISTS "Professor responsavel gerencia questoes" ON public.questoes;

CREATE POLICY "Equipe pedagogica gerencia questoes"
ON public.questoes
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'professor'::public.app_role)
  OR public.has_role(auth.uid(), 'professor_responsavel'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'professor'::public.app_role)
  OR public.has_role(auth.uid(), 'professor_responsavel'::public.app_role)
);