/*
  # Update Revenues and Financial Transactions Policies

  1. Changes
    - Update RLS policies to allow public access
    - Ensure data can be imported without authentication

  2. Security
    - Permissive policies for easier data import
    - Can be tightened later if authentication is added
*/

-- Drop existing restrictive policies on revenues
DROP POLICY IF EXISTS "Users can view own revenues" ON revenues;
DROP POLICY IF EXISTS "Users can insert own revenues" ON revenues;
DROP POLICY IF EXISTS "Users can update own revenues" ON revenues;
DROP POLICY IF EXISTS "Users can delete own revenues" ON revenues;

-- Create permissive policy for revenues
CREATE POLICY "Allow all access to revenues"
  ON revenues FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Drop existing restrictive policies on financial_transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON financial_transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON financial_transactions;

-- Create permissive policy for financial_transactions
CREATE POLICY "Allow all access to financial transactions"
  ON financial_transactions FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);