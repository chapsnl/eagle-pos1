CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings full access" ON public.settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.settings (key, value) VALUES ('staff_pin', '000000');