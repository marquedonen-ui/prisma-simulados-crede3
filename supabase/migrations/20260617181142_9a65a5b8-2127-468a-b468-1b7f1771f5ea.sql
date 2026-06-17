
-- ===== ENUM de papéis =====
CREATE TYPE public.app_role AS ENUM ('admin', 'professor', 'aluno');

-- ===== Tabela de escolas =====
CREATE TABLE public.schools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inep TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.schools TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- ===== Perfis =====
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== Papéis (separados do profile) =====
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ===== Códigos de aluno =====
CREATE TABLE public.student_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  student_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_codes TO authenticated;
GRANT ALL ON public.student_codes TO service_role;
ALTER TABLE public.student_codes ENABLE ROW LEVEL SECURITY;

-- ===== Políticas =====
-- Escolas: leitura pública (necessária pra validar código); escrita só admin.
CREATE POLICY "Anyone can read schools" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Admins manage schools" ON public.schools FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles: cada um vê e edita o próprio.
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Roles: usuário vê os próprios papéis; admin gerencia.
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Códigos de aluno: admin gerencia; professor lê códigos das suas escolas (futuro).
CREATE POLICY "Admins manage student codes" ON public.student_codes FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read student codes" ON public.student_codes FOR SELECT
  TO authenticated USING (true);

-- ===== Função: gera N códigos para uma escola (INEP + sufixo aleatório) =====
CREATE OR REPLACE FUNCTION public.generate_student_codes(_school_id UUID, _quantity INT)
RETURNS SETOF public.student_codes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inep TEXT;
  v_suffix TEXT;
  v_code TEXT;
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
  j INT;
  v_row public.student_codes;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem gerar códigos';
  END IF;

  SELECT inep INTO v_inep FROM public.schools WHERE id = _school_id;
  IF v_inep IS NULL THEN
    RAISE EXCEPTION 'Escola não encontrada';
  END IF;

  FOR i IN 1.._quantity LOOP
    LOOP
      v_suffix := '';
      FOR j IN 1..4 LOOP
        v_suffix := v_suffix || substr(v_alphabet, 1 + floor(random()*length(v_alphabet))::int, 1);
      END LOOP;
      v_code := v_inep || '-' || v_suffix;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.student_codes WHERE code = v_code);
    END LOOP;

    INSERT INTO public.student_codes (school_id, code)
    VALUES (_school_id, v_code)
    RETURNING * INTO v_row;
    RETURN NEXT v_row;
  END LOOP;
END;
$$;

-- ===== Função pública: valida código de aluno (acesso sem login) =====
CREATE OR REPLACE FUNCTION public.validate_student_code(_code TEXT)
RETURNS TABLE (code TEXT, school_id UUID, school_name TEXT, school_inep TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.student_codes
     SET last_used_at = now()
   WHERE code = _code AND is_active = true;

  SELECT sc.code, s.id, s.name, s.inep
    FROM public.student_codes sc
    JOIN public.schools s ON s.id = sc.school_id
   WHERE sc.code = _code AND sc.is_active = true;
$$;
GRANT EXECUTE ON FUNCTION public.validate_student_code(TEXT) TO anon, authenticated;

-- ===== Trigger: cria profile no signup, valida domínio @prof.ce.gov.br =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email NOT ILIKE '%@prof.ce.gov.br' THEN
    RAISE EXCEPTION 'Apenas e-mails @prof.ce.gov.br podem se cadastrar';
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'professor');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
