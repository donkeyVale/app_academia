-- Billing Agendo (SaaS) tables + RLS (super_admin only)

-- 1) Rates per academy (manual configuration, historical)
CREATE TABLE IF NOT EXISTS public.billing_academy_rates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  academy_id uuid NOT NULL,
  price_per_active_student numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'PYG',
  valid_from date NOT NULL,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_academy_rates_pkey PRIMARY KEY (id),
  CONSTRAINT billing_academy_rates_price_nonnegative CHECK (price_per_active_student >= 0),
  CONSTRAINT billing_academy_rates_valid_range CHECK ((valid_to IS NULL) OR (valid_to > valid_from)),
  CONSTRAINT billing_academy_rates_academy_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_academy_rates_academy_valid_from_uidx
  ON public.billing_academy_rates(academy_id, valid_from);

-- 2) Invoices (monthly, snapshot on day 1)
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  academy_id uuid NOT NULL,
  period_year int NOT NULL,
  period_month int NOT NULL,
  count_cutoff_date date NOT NULL,
  active_students_count int NOT NULL,
  price_per_student numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'PYG',
  total_amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  due_from_day int NOT NULL DEFAULT 5,
  due_to_day int NOT NULL DEFAULT 10,
  suspension_day int NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_invoices_pkey PRIMARY KEY (id),
  CONSTRAINT billing_invoices_period_check CHECK (period_month >= 1 AND period_month <= 12),
  CONSTRAINT billing_invoices_counts_check CHECK (active_students_count >= 0),
  CONSTRAINT billing_invoices_price_nonnegative CHECK (price_per_student >= 0),
  CONSTRAINT billing_invoices_total_nonnegative CHECK (total_amount >= 0),
  CONSTRAINT billing_invoices_status_check CHECK (status IN ('draft','issued','partially_paid','paid','overdue','cancelled')),
  CONSTRAINT billing_invoices_academy_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_academy_period_uidx
  ON public.billing_invoices(academy_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS billing_invoices_period_idx
  ON public.billing_invoices(period_year, period_month);

-- 3) Payments (history, partials)
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  invoice_id uuid NOT NULL,
  academy_id uuid NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'PYG',
  method text NOT NULL,
  reference text,
  note text,
  receipt_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_payments_pkey PRIMARY KEY (id),
  CONSTRAINT billing_payments_amount_nonnegative CHECK (amount >= 0),
  CONSTRAINT billing_payments_invoice_fkey FOREIGN KEY (invoice_id) REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  CONSTRAINT billing_payments_academy_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS billing_payments_invoice_idx
  ON public.billing_payments(invoice_id);

CREATE INDEX IF NOT EXISTS billing_payments_paid_at_idx
  ON public.billing_payments(paid_at);

-- 4) Sales agents and assignment (multiple per academy, commission over paid amounts)
CREATE TABLE IF NOT EXISTS public.billing_sales_agents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_sales_agents_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.billing_academy_sales_agents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  academy_id uuid NOT NULL,
  sales_agent_id uuid NOT NULL,
  commission_rate numeric(6,4) NOT NULL DEFAULT 0.20,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_academy_sales_agents_pkey PRIMARY KEY (id),
  CONSTRAINT billing_academy_sales_agents_rate_check CHECK (commission_rate >= 0 AND commission_rate <= 1),
  CONSTRAINT billing_academy_sales_agents_valid_range CHECK ((valid_to IS NULL) OR (valid_to > valid_from)),
  CONSTRAINT billing_academy_sales_agents_academy_fkey FOREIGN KEY (academy_id) REFERENCES public.academies(id) ON DELETE CASCADE,
  CONSTRAINT billing_academy_sales_agents_agent_fkey FOREIGN KEY (sales_agent_id) REFERENCES public.billing_sales_agents(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_academy_sales_agents_unique
  ON public.billing_academy_sales_agents(academy_id, sales_agent_id, valid_from);

-- 5) Monthly commissions snapshots (optional but useful for bookkeeping)
CREATE TABLE IF NOT EXISTS public.billing_sales_commissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  sales_agent_id uuid NOT NULL,
  period_year int NOT NULL,
  period_month int NOT NULL,
  base_paid_amount numeric(12,2) NOT NULL,
  commission_rate numeric(6,4) NOT NULL,
  commission_amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_sales_commissions_pkey PRIMARY KEY (id),
  CONSTRAINT billing_sales_commissions_period_check CHECK (period_month >= 1 AND period_month <= 12),
  CONSTRAINT billing_sales_commissions_amounts_nonnegative CHECK (base_paid_amount >= 0 AND commission_amount >= 0),
  CONSTRAINT billing_sales_commissions_rate_check CHECK (commission_rate >= 0 AND commission_rate <= 1),
  CONSTRAINT billing_sales_commissions_status_check CHECK (status IN ('pending','paid','cancelled')),
  CONSTRAINT billing_sales_commissions_agent_fkey FOREIGN KEY (sales_agent_id) REFERENCES public.billing_sales_agents(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_sales_commissions_agent_period_uidx
  ON public.billing_sales_commissions(sales_agent_id, period_year, period_month);

-- RLS: super_admin only for now
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'billing_academy_rates' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.billing_academy_rates ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'billing_invoices' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'billing_payments' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'billing_sales_agents' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.billing_sales_agents ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'billing_academy_sales_agents' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.billing_academy_sales_agents ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'billing_sales_commissions' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.billing_sales_commissions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Helper predicate for super_admin
DO $$
BEGIN
  -- billing_academy_rates
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_academy_rates' AND policyname = 'billing rates super_admin all'
  ) THEN
    CREATE POLICY "billing rates super_admin all" ON public.billing_academy_rates
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    );
  END IF;

  -- billing_invoices
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_invoices' AND policyname = 'billing invoices super_admin all'
  ) THEN
    CREATE POLICY "billing invoices super_admin all" ON public.billing_invoices
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    );
  END IF;

  -- billing_payments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_payments' AND policyname = 'billing payments super_admin all'
  ) THEN
    CREATE POLICY "billing payments super_admin all" ON public.billing_payments
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    );
  END IF;

  -- billing_sales_agents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_sales_agents' AND policyname = 'billing sales_agents super_admin all'
  ) THEN
    CREATE POLICY "billing sales_agents super_admin all" ON public.billing_sales_agents
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    );
  END IF;

  -- billing_academy_sales_agents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_academy_sales_agents' AND policyname = 'billing academy_sales_agents super_admin all'
  ) THEN
    CREATE POLICY "billing academy_sales_agents super_admin all" ON public.billing_academy_sales_agents
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    );
  END IF;

  -- billing_sales_commissions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_sales_commissions' AND policyname = 'billing sales_commissions super_admin all'
  ) THEN
    CREATE POLICY "billing sales_commissions super_admin all" ON public.billing_sales_commissions
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'super_admin'::public.app_role
      )
    );
  END IF;
END $$;

-- Notes:
-- - price_per_active_student is manual per academy (e.g. 12000 or 15000) and can change over time.
-- - Invoices snapshot on day 1 of month calendar.
-- - Payments are used for commissions base (paid amounts).
-- - Admin access can be enabled later with additional SELECT policies filtered by academy_id.
