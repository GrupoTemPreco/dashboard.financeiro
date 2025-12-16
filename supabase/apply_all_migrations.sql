-- ============================================
-- Script para aplicar todas as migrations
-- Execute este arquivo no SQL Editor do Supabase Dashboard
-- ============================================

-- Migration: 20250919235320_light_sun.sql
/*
  # Create companies table

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `company_code` (text, unique)
      - `company_name` (text)
      - `group_name` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `companies` table
    - Add policy for authenticated users to read and manage companies
*/

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_code text UNIQUE NOT NULL,
  company_name text NOT NULL,
  group_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read companies" ON companies;
CREATE POLICY "Users can read companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert companies" ON companies;
CREATE POLICY "Users can insert companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update companies" ON companies;
CREATE POLICY "Users can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can delete companies" ON companies;
CREATE POLICY "Users can delete companies"
  ON companies
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(company_code);
CREATE INDEX IF NOT EXISTS idx_companies_group ON companies(group_name);

-- Migration: 20251109160643_create_companies_and_accounts_payable.sql
-- Note: This migration adds user_id and other columns, but we'll handle it in the update migration

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'name'
  ) THEN
    ALTER TABLE companies ADD COLUMN name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'business_units'
  ) THEN
    ALTER TABLE companies ADD COLUMN business_units text[] DEFAULT '{}';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS accounts_payable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  business_unit text NOT NULL,
  chart_of_accounts text NOT NULL,
  creditor text NOT NULL,
  status text NOT NULL CHECK (status IN ('paga', 'pendente', 'realizado', 'previsto')),
  payment_date date NOT NULL,
  amount decimal(15, 2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_company_id ON accounts_payable(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON accounts_payable(status);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_payment_date ON accounts_payable(payment_date);

-- Migration: 20251109182910_create_revenues_table.sql
CREATE TABLE IF NOT EXISTS revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pendente',
  business_unit text NOT NULL,
  chart_of_accounts text NOT NULL,
  payment_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE revenues ENABLE ROW LEVEL SECURITY;

-- Migration: 20251109184742_create_financial_transactions_table.sql
CREATE TABLE IF NOT EXISTS financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'previsto',
  business_unit text NOT NULL,
  chart_of_accounts text NOT NULL,
  transaction_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Migration: 20251109233247_update_companies_structure.sql
-- Make user_id nullable for easier import
ALTER TABLE companies ALTER COLUMN user_id DROP NOT NULL;

-- Add unique constraint on company_code if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'companies_company_code_key'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_company_code_key UNIQUE (company_code);
  END IF;
END $$;

-- Update policies
DROP POLICY IF EXISTS "Users can read companies" ON companies;
DROP POLICY IF EXISTS "Users can insert companies" ON companies;
DROP POLICY IF EXISTS "Users can update companies" ON companies;
DROP POLICY IF EXISTS "Users can delete companies" ON companies;
DROP POLICY IF EXISTS "Users can view own companies" ON companies;
DROP POLICY IF EXISTS "Users can insert own companies" ON companies;
DROP POLICY IF EXISTS "Users can update own companies" ON companies;
DROP POLICY IF EXISTS "Users can delete own companies" ON companies;
DROP POLICY IF EXISTS "Allow all access to companies" ON companies;

CREATE POLICY "Allow all access to companies"
  ON companies FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Migration: 20251109233257_update_accounts_payable_structure.sql
ALTER TABLE accounts_payable ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE accounts_payable DROP CONSTRAINT IF EXISTS accounts_payable_status_check;
ALTER TABLE accounts_payable ADD CONSTRAINT accounts_payable_status_check 
  CHECK (status IN ('realizado', 'previsto', 'paga', 'pendente'));

DROP POLICY IF EXISTS "Users can manage company accounts payable" ON accounts_payable;
DROP POLICY IF EXISTS "Allow all access to accounts payable" ON accounts_payable;

CREATE POLICY "Allow all access to accounts payable"
  ON accounts_payable FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Migration: 20251109233307_update_revenues_and_transactions_policies.sql
DROP POLICY IF EXISTS "Users can read all revenues" ON revenues;
DROP POLICY IF EXISTS "Users can insert revenues" ON revenues;
DROP POLICY IF EXISTS "Users can update revenues" ON revenues;
DROP POLICY IF EXISTS "Users can delete revenues" ON revenues;
DROP POLICY IF EXISTS "Users can view own revenues" ON revenues;
DROP POLICY IF EXISTS "Users can insert own revenues" ON revenues;
DROP POLICY IF EXISTS "Users can update own revenues" ON revenues;
DROP POLICY IF EXISTS "Users can delete own revenues" ON revenues;
DROP POLICY IF EXISTS "Allow all access to revenues" ON revenues;

CREATE POLICY "Allow all access to revenues"
  ON revenues FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read all financial transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Users can insert financial transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Users can update financial transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Users can delete financial transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Allow all access to financial transactions" ON financial_transactions;

CREATE POLICY "Allow all access to financial transactions"
  ON financial_transactions FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Migration: 20251110200305_add_import_tracking.sql
CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_type text NOT NULL,
  record_count integer DEFAULT 0,
  imported_at timestamptz DEFAULT now(),
  user_id uuid
);

ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to imports" ON imports;
CREATE POLICY "Allow all access to imports"
  ON imports
  FOR ALL
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts_payable' AND column_name = 'import_id'
  ) THEN
    ALTER TABLE accounts_payable ADD COLUMN import_id uuid REFERENCES imports(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'revenues' AND column_name = 'import_id'
  ) THEN
    ALTER TABLE revenues ADD COLUMN import_id uuid REFERENCES imports(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financial_transactions' AND column_name = 'import_id'
  ) THEN
    ALTER TABLE financial_transactions ADD COLUMN import_id uuid REFERENCES imports(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migration: 20251110220253_create_forecasted_entries_table.sql
CREATE TABLE IF NOT EXISTS forecasted_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('paga', 'pendente')),
  business_unit text NOT NULL,
  chart_of_accounts text NOT NULL,
  supplier text NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL,
  import_id uuid REFERENCES imports(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE forecasted_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to forecasted_entries" ON forecasted_entries;
DROP POLICY IF EXISTS "Allow public insert access to forecasted_entries" ON forecasted_entries;
DROP POLICY IF EXISTS "Allow public update access to forecasted_entries" ON forecasted_entries;
DROP POLICY IF EXISTS "Allow public delete access to forecasted_entries" ON forecasted_entries;

CREATE POLICY "Allow public read access to forecasted_entries"
  ON forecasted_entries
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to forecasted_entries"
  ON forecasted_entries
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to forecasted_entries"
  ON forecasted_entries
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to forecasted_entries"
  ON forecasted_entries
  FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_forecasted_entries_import_id ON forecasted_entries(import_id);
CREATE INDEX IF NOT EXISTS idx_forecasted_entries_due_date ON forecasted_entries(due_date);
CREATE INDEX IF NOT EXISTS idx_forecasted_entries_status ON forecasted_entries(status);

-- Migration: 20251110224400_create_initial_balances_and_daily_sales.sql
-- Note: This creates initial_balances, but a later migration recreates it. We'll handle the final version.

CREATE TABLE IF NOT EXISTS daily_sales_forecast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit text NOT NULL,
  daily_amount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE daily_sales_forecast ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on daily_sales_forecast" ON daily_sales_forecast;
CREATE POLICY "Allow all operations on daily_sales_forecast"
  ON daily_sales_forecast
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_daily_sales_business_unit ON daily_sales_forecast(business_unit);

-- Migration: 20251111195840_create_revenues_dre_table.sql
CREATE TABLE IF NOT EXISTS revenues_dre (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  business_unit text NOT NULL,
  chart_of_accounts text NOT NULL,
  issue_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  import_id uuid REFERENCES imports(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE revenues_dre ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_revenues_dre_issue_date ON revenues_dre(issue_date);
CREATE INDEX IF NOT EXISTS idx_revenues_dre_business_unit ON revenues_dre(business_unit);
CREATE INDEX IF NOT EXISTS idx_revenues_dre_import_id ON revenues_dre(import_id);
CREATE INDEX IF NOT EXISTS idx_revenues_dre_status ON revenues_dre(status);

-- Migration: 20251111202142_create_cmv_dre_table.sql
CREATE TABLE IF NOT EXISTS cmv_dre (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  business_unit text NOT NULL,
  chart_of_accounts text NOT NULL,
  issue_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  import_id uuid REFERENCES imports(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cmv_dre ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cmv_dre_issue_date ON cmv_dre(issue_date);
CREATE INDEX IF NOT EXISTS idx_cmv_dre_business_unit ON cmv_dre(business_unit);
CREATE INDEX IF NOT EXISTS idx_cmv_dre_import_id ON cmv_dre(import_id);
CREATE INDEX IF NOT EXISTS idx_cmv_dre_status ON cmv_dre(status);

-- Migration: 20251111212839_fix_revenues_dre_rls_policies.sql
DROP POLICY IF EXISTS "Users can view revenues_dre data" ON revenues_dre;
DROP POLICY IF EXISTS "Users can insert revenues_dre data" ON revenues_dre;
DROP POLICY IF EXISTS "Users can update revenues_dre data" ON revenues_dre;
DROP POLICY IF EXISTS "Users can delete revenues_dre data" ON revenues_dre;
DROP POLICY IF EXISTS "Allow anon to view revenues_dre" ON revenues_dre;
DROP POLICY IF EXISTS "Allow anon to insert revenues_dre" ON revenues_dre;
DROP POLICY IF EXISTS "Allow anon to update revenues_dre" ON revenues_dre;
DROP POLICY IF EXISTS "Allow anon to delete revenues_dre" ON revenues_dre;

CREATE POLICY "Allow anon to view revenues_dre"
  ON revenues_dre
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon to insert revenues_dre"
  ON revenues_dre
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update revenues_dre"
  ON revenues_dre
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete revenues_dre"
  ON revenues_dre
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Migration: 20251111212850_fix_cmv_dre_rls_policies.sql
DROP POLICY IF EXISTS "Users can view cmv_dre data" ON cmv_dre;
DROP POLICY IF EXISTS "Users can insert cmv_dre data" ON cmv_dre;
DROP POLICY IF EXISTS "Users can update cmv_dre data" ON cmv_dre;
DROP POLICY IF EXISTS "Users can delete cmv_dre data" ON cmv_dre;
DROP POLICY IF EXISTS "Allow anon to view cmv_dre" ON cmv_dre;
DROP POLICY IF EXISTS "Allow anon to insert cmv_dre" ON cmv_dre;
DROP POLICY IF EXISTS "Allow anon to update cmv_dre" ON cmv_dre;
DROP POLICY IF EXISTS "Allow anon to delete cmv_dre" ON cmv_dre;

CREATE POLICY "Allow anon to view cmv_dre"
  ON cmv_dre
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon to insert cmv_dre"
  ON cmv_dre
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update cmv_dre"
  ON cmv_dre
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete cmv_dre"
  ON cmv_dre
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Migration: 20251113174933_create_initial_balances_table.sql
-- Drop old initial_balances if it exists with different structure
DROP TABLE IF EXISTS initial_balances CASCADE;

CREATE TABLE initial_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit text NOT NULL,
  bank_name text NOT NULL DEFAULT 'Banco',
  balance numeric NOT NULL DEFAULT 0,
  balance_date date NOT NULL DEFAULT CURRENT_DATE,
  import_id uuid REFERENCES imports(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE initial_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on initial_balances" ON initial_balances;
DROP POLICY IF EXISTS "Allow all access to initial_balances" ON initial_balances;

CREATE POLICY "Allow all access to initial_balances"
  ON initial_balances FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_initial_balances_business_unit ON initial_balances(business_unit);
CREATE INDEX IF NOT EXISTS idx_initial_balances_date ON initial_balances(balance_date);

-- Migration: 20251113210238_create_dre_budget_table.sql
CREATE TABLE IF NOT EXISTS dre_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit text NOT NULL,
  account_name text NOT NULL,
  period_date date NOT NULL,
  budget_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dre_budget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to dre_budget" ON dre_budget;
CREATE POLICY "Allow all access to dre_budget"
  ON dre_budget FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dre_budget_business_unit ON dre_budget(business_unit);
CREATE INDEX IF NOT EXISTS idx_dre_budget_period_date ON dre_budget(period_date);
CREATE INDEX IF NOT EXISTS idx_dre_budget_account ON dre_budget(account_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dre_budget_unique 
  ON dre_budget(business_unit, account_name, period_date);

-- ============================================
-- Fim das migrations
-- ============================================

