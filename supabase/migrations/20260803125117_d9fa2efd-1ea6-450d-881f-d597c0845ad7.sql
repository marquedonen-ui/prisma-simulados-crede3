-- 1. devolutivas_respostas: aplicar as mesmas regras de visibilidade da devolutiva
DROP POLICY IF EXISTS "Resp visiveis se devolutiva visivel" ON public.devolutivas_respostas;
CREATE POLICY "Resp visiveis se devolutiva visivel"
ON public.devolutivas_respostas FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.devolutivas d
  WHERE d.id = devolutivas_respostas.devolutiva_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'superintendente')
      OR d.autor_id = auth.uid()
      OR ((public.has_role(auth.uid(), 'gestor')
           OR public.has_role(auth.uid(), 'professor_responsavel')
           OR public.has_role(auth.uid(), 'professor_escola')
           OR public.has_role(auth.uid(), 'professor'))
          AND d.school_id = public.get_my_school())
    )
));

DROP POLICY IF EXISTS "Resp insert pelo proprio autor com acesso" ON public.devolutivas_respostas;
CREATE POLICY "Resp insert pelo proprio autor com acesso"
ON public.devolutivas_respostas FOR INSERT TO authenticated
WITH CHECK (autor_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.devolutivas d
  WHERE d.id = devolutivas_respostas.devolutiva_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'superintendente')
      OR d.autor_id = auth.uid()
      OR ((public.has_role(auth.uid(), 'gestor')
           OR public.has_role(auth.uid(), 'professor_responsavel')
           OR public.has_role(auth.uid(), 'professor_escola')
           OR public.has_role(auth.uid(), 'professor'))
          AND d.school_id = public.get_my_school())
    )
));

-- 2. Storage: cartões de resposta (gabarito) só após liberação ou para admin
DROP POLICY IF EXISTS "Authenticated read diagnostic files" ON storage.objects;
CREATE POLICY "Authenticated read diagnostic files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'diagnostic-assessments'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR NOT EXISTS (
      SELECT 1 FROM public.diagnostic_assessments a
      WHERE a.answer_sheet_pdf_path = storage.objects.name
        AND a.gabarito_liberado = false
    )
  )
);

-- 3. schools: exigir autenticação
DROP POLICY IF EXISTS "Anyone can read schools" ON public.schools;
CREATE POLICY "Escolas visiveis para autenticados"
ON public.schools FOR SELECT TO authenticated
USING (true);
REVOKE SELECT ON public.schools FROM anon;