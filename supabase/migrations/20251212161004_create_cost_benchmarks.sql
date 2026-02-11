-- Create cost_benchmarks table for storing target cost percentages
CREATE TABLE public.cost_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE CHECK (category IN ('wages', 'cogs', 'security')),
  benchmark_percent numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.cost_benchmarks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read benchmarks
CREATE POLICY "Authenticated users can read benchmarks"
  ON public.cost_benchmarks
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update benchmarks
CREATE POLICY "Authenticated users can insert benchmarks"
  ON public.cost_benchmarks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update benchmarks"
  ON public.cost_benchmarks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default benchmark values (0%)
INSERT INTO public.cost_benchmarks (category, benchmark_percent)
VALUES 
  ('wages', 0),
  ('cogs', 0),
  ('security', 0);;
