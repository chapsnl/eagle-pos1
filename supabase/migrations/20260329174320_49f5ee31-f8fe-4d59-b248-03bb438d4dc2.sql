
-- Allow anonymous users to insert/update/delete sessions
CREATE POLICY "Anyone can insert sessions" ON public.sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can update sessions" ON public.sessions FOR UPDATE TO anon USING (true);
CREATE POLICY "Anyone can delete sessions" ON public.sessions FOR DELETE TO anon USING (true);

-- Allow anonymous users to insert/delete drink_logs
CREATE POLICY "Anyone can insert drink_logs" ON public.drink_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can delete drink_logs" ON public.drink_logs FOR DELETE TO anon USING (true);

-- Enable realtime on drink_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.drink_logs;
