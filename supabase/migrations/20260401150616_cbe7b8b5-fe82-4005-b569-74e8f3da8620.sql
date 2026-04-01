ALTER TABLE public.sessions ADD COLUMN locked_by text DEFAULT NULL;
ALTER TABLE public.sessions ADD COLUMN locked_at timestamptz DEFAULT NULL;