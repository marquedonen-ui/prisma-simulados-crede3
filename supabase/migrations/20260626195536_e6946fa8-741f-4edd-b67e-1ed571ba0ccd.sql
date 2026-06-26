
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superintendente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'professor_escola';

DO $$ BEGIN
  CREATE TYPE public.devolutiva_status AS ENUM ('enviada','em_processo','finalizada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS disciplinas text[],
  ADD COLUMN IF NOT EXISTS serie text,
  ADD COLUMN IF NOT EXISTS turno text;
