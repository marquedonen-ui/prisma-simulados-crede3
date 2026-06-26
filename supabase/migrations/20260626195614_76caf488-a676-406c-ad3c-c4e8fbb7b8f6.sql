
-- professor_turmas
CREATE TABLE IF NOT EXISTS public.professor_turmas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, turma_id)
);

GRANT SELECT ON public.professor_turmas TO authenticated;
GRANT ALL ON public.professor_turmas TO service_role;
ALTER TABLE public.professor_turmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia professor_turmas" ON public.professor_turmas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Prof responsavel gerencia da sua escola" ON public.professor_turmas
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'professor_responsavel')
    AND EXISTS (SELECT 1 FROM public.turmas t WHERE t.id = professor_turmas.turma_id AND t.school_id = public.get_my_school())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'professor_responsavel')
    AND EXISTS (SELECT 1 FROM public.turmas t WHERE t.id = professor_turmas.turma_id AND t.school_id = public.get_my_school())
  );

CREATE POLICY "Usuario ve suas proprias lotacoes" ON public.professor_turmas
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- minhas_turmas_ids helper
CREATE OR REPLACE FUNCTION public.minhas_turmas_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT turma_id FROM public.professor_turmas WHERE user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.minhas_turmas_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_turmas_ids() TO authenticated;

-- devolutivas
CREATE TABLE IF NOT EXISTS public.devolutivas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  status public.devolutiva_status NOT NULL DEFAULT 'enviada',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.devolutivas TO authenticated;
GRANT ALL ON public.devolutivas TO service_role;
ALTER TABLE public.devolutivas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devolutivas visiveis" ON public.devolutivas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'superintendente')
    OR autor_id = auth.uid()
    OR (
      (public.has_role(auth.uid(),'gestor')
        OR public.has_role(auth.uid(),'professor_responsavel')
        OR public.has_role(auth.uid(),'professor_escola')
        OR public.has_role(auth.uid(),'professor'))
      AND school_id = public.get_my_school()
    )
  );

CREATE POLICY "Devolutivas insert sup/admin" ON public.devolutivas
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND (public.has_role(auth.uid(),'superintendente') OR public.has_role(auth.uid(),'admin'))
  );

CREATE POLICY "Devolutivas update" ON public.devolutivas
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR autor_id = auth.uid()
    OR (public.has_role(auth.uid(),'gestor') AND school_id = public.get_my_school())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR autor_id = auth.uid()
    OR (public.has_role(auth.uid(),'gestor') AND school_id = public.get_my_school())
  );

CREATE POLICY "Devolutivas delete autor/admin" ON public.devolutivas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR autor_id = auth.uid());

CREATE TRIGGER trg_devolutivas_updated_at BEFORE UPDATE ON public.devolutivas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_devolutivas_school ON public.devolutivas(school_id);
CREATE INDEX IF NOT EXISTS idx_devolutivas_autor ON public.devolutivas(autor_id);

-- devolutivas_respostas
CREATE TABLE IF NOT EXISTS public.devolutivas_respostas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devolutiva_id uuid NOT NULL REFERENCES public.devolutivas(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mensagem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.devolutivas_respostas TO authenticated;
GRANT ALL ON public.devolutivas_respostas TO service_role;
ALTER TABLE public.devolutivas_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resp visiveis se devolutiva visivel" ON public.devolutivas_respostas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.devolutivas d WHERE d.id = devolutiva_id));

CREATE POLICY "Resp insert pelo proprio autor com acesso" ON public.devolutivas_respostas
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.devolutivas d WHERE d.id = devolutiva_id)
  );

CREATE POLICY "Resp delete admin/autor" ON public.devolutivas_respostas
  FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- respostas_alunos: leitura por superintendente e prof_escola
DO $$ BEGIN
  CREATE POLICY "Prof escola le respostas das suas turmas" ON public.respostas_alunos
    FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(),'professor_escola')
      AND turma_id IN (SELECT public.minhas_turmas_ids())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Superintendente le todas respostas" ON public.respostas_alunos
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(),'superintendente'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
