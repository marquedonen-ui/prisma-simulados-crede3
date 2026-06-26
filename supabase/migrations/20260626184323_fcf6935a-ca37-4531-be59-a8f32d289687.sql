
CREATE TABLE public.cronograma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  periodo_label text NOT NULL,
  acao text NOT NULL,
  responsaveis text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cronograma TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.cronograma TO authenticated;
GRANT ALL ON public.cronograma TO service_role;

ALTER TABLE public.cronograma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view cronograma"
  ON public.cronograma FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can view cronograma"
  ON public.cronograma FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Admins can insert cronograma"
  ON public.cronograma FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update cronograma"
  ON public.cronograma FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete cronograma"
  ON public.cronograma FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_cronograma_updated_at
  BEFORE UPDATE ON public.cronograma
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.cronograma (data_inicio, data_fim, periodo_label, acao, responsaveis, ordem) VALUES
('2025-06-17','2025-06-18','17 e 18/junho','Apresentação do Simulado. Formação com os professores e validação dos PCA''s.','Articulador de Gestão, Formadores do Foco e Técnicos da CREDE 3',1),
('2025-06-30','2025-06-30','30/junho','Data limite para envio das questões elaboradas por cada escola para compor o banco de questões dos Simulados Regionais.','PCA e professores das escolas',2),
('2025-07-01','2025-07-30','1 a 30/julho','Curadoria para a escolha dos itens que comporão os Simulados Regionais.','Articulador de Gestão e Formadores do Foco',3),
('2025-08-01','2025-08-18','1 a 18/Agosto','Formatação da prova, elaboração do gabarito oficial e validação/aprovação da prova e da plataforma digital (PRISMA).','Técnicos da CREDE 3',4),
('2025-08-19','2025-08-20','19 e 20/Agosto','Encontro com os professores do LEI para a capacitação no uso da plataforma digital PRISMA e tutoriais para inserção para uso do aplicativo de correção de gabarito e inserção dos dados na plataforma.','Técnicos da CREDE 3 e professores dos LEI''s',5),
('2025-08-24','2025-08-28','24 a 28/agosto','Aplicação do 1° Simulado Regional de Ciências da Natureza.','Escolas da CREDE 3',6),
('2025-09-01','2025-09-04','1 a 4/Setembro','Aplicação do 1° Simulado Regional de Ciências Humanas.','Escolas da CREDE 3',7),
('2025-09-08','2025-09-11','8 a 11/Setembro','Inserção dos resultados de cada escola na plataforma PRISMA.','Professores dos LEI''s',8);
