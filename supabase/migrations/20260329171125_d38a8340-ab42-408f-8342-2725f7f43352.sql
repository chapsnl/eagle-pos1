
-- Drop overly permissive policies on products
DROP POLICY IF EXISTS "Products are insertable by everyone" ON public.products;
DROP POLICY IF EXISTS "Products are updatable by everyone" ON public.products;

-- Restrict products INSERT/UPDATE to authenticated users only
CREATE POLICY "Authenticated users can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (true);

-- Drop overly permissive policies on sessions
DROP POLICY IF EXISTS "Sessions full access" ON public.sessions;

-- Sessions: SELECT for everyone (needed for lookups), write for authenticated
CREATE POLICY "Sessions readable by everyone"
  ON public.sessions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert sessions"
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sessions"
  ON public.sessions FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete sessions"
  ON public.sessions FOR DELETE TO authenticated
  USING (true);

-- Drop overly permissive policies on drink_logs
DROP POLICY IF EXISTS "Drink logs full access" ON public.drink_logs;

-- Drink logs: SELECT for everyone, write for authenticated
CREATE POLICY "Drink logs readable by everyone"
  ON public.drink_logs FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert drink_logs"
  ON public.drink_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete drink_logs"
  ON public.drink_logs FOR DELETE TO authenticated
  USING (true);
