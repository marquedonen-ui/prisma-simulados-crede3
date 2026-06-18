
-- 1) alunos: remove blanket authenticated read (per-role policies already exist)
DROP POLICY IF EXISTS "Authenticated read alunos" ON public.alunos;

-- Add admin SELECT explicitly (was implicit via ALL policy, keep explicit for clarity)
-- Admin ALL policy already grants SELECT; nothing to add.

-- 2) questoes: remove blanket authenticated read
DROP POLICY IF EXISTS "Authenticated read questoes" ON public.questoes;

-- 3) student_codes: remove blanket authenticated read; add scoped policies
DROP POLICY IF EXISTS "Authenticated read student codes" ON public.student_codes;

CREATE POLICY "Prof resp/gestor leem codigos da sua escola"
  ON public.student_codes
  FOR SELECT
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'professor_responsavel'::public.app_role)
     OR public.has_role(auth.uid(), 'gestor'::public.app_role))
    AND school_id = public.get_my_school()
  );

-- 4) resultados_simulados: drop the broad legacy 'professor' policy
DROP POLICY IF EXISTS "Admins and professors manage resultados" ON public.resultados_simulados;

-- Re-add admin-only management (replacement for the dropped ALL)
CREATE POLICY "Admins gerenciam resultados"
  ON public.resultados_simulados
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Drop the legacy permissive SELECT that included 'professor'
DROP POLICY IF EXISTS "Users read own resultados, professors/admins read all" ON public.resultados_simulados;

CREATE POLICY "Admins leem todos os resultados"
  ON public.resultados_simulados
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Usuario le seus proprios resultados"
  ON public.resultados_simulados
  FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

-- 5) respostas_alunos: drop the broad legacy 'professor' policies
DROP POLICY IF EXISTS "Professors and admins manage respostas" ON public.respostas_alunos;
DROP POLICY IF EXISTS "Users read own respostas, professors/admins read all" ON public.respostas_alunos;

-- Replacement: admin-only management
CREATE POLICY "Admins gerenciam respostas"
  ON public.respostas_alunos
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins leem todas as respostas"
  ON public.respostas_alunos
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Usuario le suas proprias respostas"
  ON public.respostas_alunos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

-- 6) Restrict SECURITY DEFINER helper functions: revoke from public/anon, allow authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_my_school() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_school() TO authenticated, service_role;

-- generate_student_codes is admin-only by check; still restrict callers
REVOKE EXECUTE ON FUNCTION public.generate_student_codes(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_student_codes(uuid, integer) TO authenticated, service_role;

-- validate_student_code is intentionally callable by anon (student login by code)
-- keep PUBLIC EXECUTE; no change.
