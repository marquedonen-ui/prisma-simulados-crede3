
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_by_admin boolean := COALESCE((NEW.raw_user_meta_data->>'created_by_admin')::boolean, false);
BEGIN
  IF NOT v_created_by_admin THEN
    IF NEW.email IS NULL OR NEW.email NOT ILIKE '%@prof.ce.gov.br' THEN
      RAISE EXCEPTION 'Apenas e-mails @prof.ce.gov.br podem se cadastrar';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, school_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'school_id', '')::uuid
  );

  -- Só atribui 'professor' automaticamente quando NÃO é cadastro pelo admin
  IF NOT v_created_by_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'professor');
  END IF;

  RETURN NEW;
END;
$$;
