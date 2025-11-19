/*
  # Create Companies and Accounts Payable Tables

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text, company name)
      - `business_units` (text array, list of business units)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `accounts_payable`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `business_unit` (text, references business unit from company)
      - `chart_of_accounts` (text, for chart of accounts reference)
      - `creditor` (text, supplier/vendor name)
      - `status` (text, 'paga' or 'pendente')
      - `payment_date` (date)
      - `amount` (decimal, value in currency)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own companies and related data
*/

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  business_units text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own companies"
  ON companies FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own companies"
  ON companies FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS accounts_payable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  business_unit text NOT NULL,
  chart_of_accounts text NOT NULL,
  creditor text NOT NULL,
  status text NOT NULL CHECK (status IN ('paga', 'pendente')),
  payment_date date NOT NULL,
  amount decimal(15, 2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage company accounts payable"
  ON accounts_payable FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = accounts_payable.company_id
      AND companies.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = accounts_payable.company_id
      AND companies.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_company_id ON accounts_payable(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON accounts_payable(status);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_payment_date ON accounts_payable(payment_date);
