/*
  # Create DRE Budget Table

  1. New Tables
    - `dre_budget`
      - `id` (uuid, primary key)
      - `business_unit` (text) - unidade de negócio
      - `account_name` (text) - nome da conta/linha da DRE
      - `period_date` (date) - data do período (mês/ano)
      - `budget_amount` (numeric) - valor do orçamento
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Add policies for authenticated and anonymous users

  3. Indexes
    - Index on business_unit for fast filtering
    - Index on period_date for date filtering
    - Unique constraint on business_unit + account_name + period_date

  4. Notes
    - Stores budget values for each DRE line item
    - One budget value per business unit, account, and period
    - Editable by users through the interface
*/

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

CREATE POLICY "Allow all access to dre_budget"
  ON dre_budget FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dre_budget_business_unit ON dre_budget(business_unit);
CREATE INDEX IF NOT EXISTS idx_dre_budget_period_date ON dre_budget(period_date);
CREATE INDEX IF NOT EXISTS idx_dre_budget_account ON dre_budget(account_name);

-- Unique constraint to prevent duplicate budgets for same business unit, account, and period
CREATE UNIQUE INDEX IF NOT EXISTS idx_dre_budget_unique 
  ON dre_budget(business_unit, account_name, period_date);