
-- Session status enum
CREATE TYPE public.session_status AS ENUM ('active', 'paid', 'incident', 'archived');

-- Products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shorthand text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  category_color text NOT NULL DEFAULT '#e4e2e2',
  price decimal(10,2) NOT NULL DEFAULT 0,
  stock_count integer NOT NULL DEFAULT 0
);

-- Sessions table
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nfc_uid text UNIQUE,
  wardrobe_number text,
  status session_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  total_amount decimal(10,2) NOT NULL DEFAULT 0,
  actual_paid_amount decimal(10,2),
  is_event_numbered boolean NOT NULL DEFAULT false
);

-- Drink logs table
CREATE TABLE public.drink_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  timestamp timestamptz NOT NULL DEFAULT now(),
  price_at_time decimal(10,2) NOT NULL
);

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drink_logs ENABLE ROW LEVEL SECURITY;

-- Public read for products (POS is internal tool)
CREATE POLICY "Products are readable by everyone" ON public.products FOR SELECT USING (true);
CREATE POLICY "Products are insertable by everyone" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Products are updatable by everyone" ON public.products FOR UPDATE USING (true);

-- Sessions policies (internal POS, no auth needed)
CREATE POLICY "Sessions full access" ON public.sessions FOR ALL USING (true) WITH CHECK (true);

-- Drink logs policies
CREATE POLICY "Drink logs full access" ON public.drink_logs FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
