
CREATE TABLE IF NOT EXISTS public.alunos_ausentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.diagnostic_assessments(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  numero_chamada int NOT NULL CHECK (numero_chamada > 0),
  nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (simulado_id, turma_id, numero_chamada)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alunos_ausentes TO authenticated;
GRANT ALL ON public.alunos_ausentes TO service_role;

ALTER TABLE public.alunos_ausentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alunos_ausentes admin all"
ON public.alunos_ausentes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "alunos_ausentes prof_resp same school select"
ON public.alunos_ausentes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'professor_responsavel')
  AND EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = alunos_ausentes.turma_id
      AND t.school_id = public.get_my_school()
  )
);

CREATE POLICY "alunos_ausentes prof_resp same school insert"
ON public.alunos_ausentes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'professor_responsavel')
  AND EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = alunos_ausentes.turma_id
      AND t.school_id = public.get_my_school()
  )
);

CREATE POLICY "alunos_ausentes prof_resp same school update"
ON public.alunos_ausentes
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'professor_responsavel')
  AND EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = alunos_ausentes.turma_id
      AND t.school_id = public.get_my_school()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'professor_responsavel')
  AND EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = alunos_ausentes.turma_id
      AND t.school_id = public.get_my_school()
  )
);

CREATE POLICY "alunos_ausentes prof_resp same school delete"
ON public.alunos_ausentes
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'professor_responsavel')
  AND EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = alunos_ausentes.turma_id
      AND t.school_id = public.get_my_school()
  )
);
