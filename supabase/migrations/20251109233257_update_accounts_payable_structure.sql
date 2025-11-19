/*
  # Update Accounts Payable Structure

  1. Changes
    - Remove company_id dependency (not needed for our use case)
    - Update status values to match import format ('realizado', 'previsto')
    - Make table accessible without authentication

  2. Notes
    - Allows direct import of accounts payable data
    - Status matches Brazilian terminology
*/

-- Make company_id nullable
ALTER TABLE accounts_payable ALTER COLUMN company_id DROP NOT NULL;

-- Update status check constraint
ALTER TABLE accounts_payable DROP CONSTRAINT IF EXISTS accounts_payable_status_check;
ALTER TABLE accounts_payable ADD CONSTRAINT accounts_payable_status_check 
  CHECK (status IN ('realizado', 'previsto', 'paga', 'pendente'));

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can manage company accounts payable" ON accounts_payable;

-- Create permissive policy for easier import
CREATE POLICY "Allow all access to accounts payable"
  ON accounts_payable FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);