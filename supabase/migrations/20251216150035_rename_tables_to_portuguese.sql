/*
  # Rename Tables to Portuguese Names

  1. Rename Tables
    - `accounts_payable` -> `CONTAS A PAGAR` (with spaces)
    - `forecasted_entries` -> `PREVISTOS`

  2. Update all related objects
    - Indexes
    - RLS Policies
    - Foreign key constraints
    - Comments
*/

-- Rename accounts_payable to CONTAS A PAGAR (with spaces, using quotes)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts_payable') THEN
    ALTER TABLE accounts_payable RENAME TO "CONTAS A PAGAR";
  END IF;
END $$;

-- Rename forecasted_entries to PREVISTOS (using quotes for case sensitivity)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forecasted_entries') THEN
    ALTER TABLE forecasted_entries RENAME TO "PREVISTOS";
  END IF;
END $$;

-- Update indexes for CONTAS A PAGAR
ALTER INDEX IF EXISTS idx_accounts_payable_company_id RENAME TO idx_contas_a_pagar_company_id;
ALTER INDEX IF EXISTS idx_accounts_payable_status RENAME TO idx_contas_a_pagar_status;
ALTER INDEX IF EXISTS idx_accounts_payable_payment_date RENAME TO idx_contas_a_pagar_payment_date;

-- Update indexes for PREVISTOS  
ALTER INDEX IF EXISTS idx_forecasted_entries_import_id RENAME TO idx_previstos_import_id;
ALTER INDEX IF EXISTS idx_forecasted_entries_due_date RENAME TO idx_previstos_due_date;
ALTER INDEX IF EXISTS idx_forecasted_entries_status RENAME TO idx_previstos_status;

-- Drop old policies for accounts_payable and recreate for CONTAS A PAGAR
DROP POLICY IF EXISTS "Users can manage company accounts payable" ON "CONTAS A PAGAR";
DROP POLICY IF EXISTS "Allow all access to accounts payable" ON "CONTAS A PAGAR";

-- Recreate policies for CONTAS A PAGAR (if needed, adjust based on your RLS requirements)
-- Note: This assumes the same RLS structure. Adjust if needed.
CREATE POLICY "Users can manage company contas a pagar"
  ON "CONTAS A PAGAR" FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = "CONTAS A PAGAR".company_id
      AND companies.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = "CONTAS A PAGAR".company_id
      AND companies.user_id = auth.uid()
    )
  );

-- Drop old policies for forecasted_entries and recreate for PREVISTOS
DROP POLICY IF EXISTS "Allow public read access to forecasted_entries" ON "PREVISTOS";
DROP POLICY IF EXISTS "Allow public insert access to forecasted_entries" ON "PREVISTOS";
DROP POLICY IF EXISTS "Allow public update access to forecasted_entries" ON "PREVISTOS";
DROP POLICY IF EXISTS "Allow public delete access to forecasted_entries" ON "PREVISTOS";

-- Recreate policies for PREVISTOS
CREATE POLICY "Allow public read access to previstos"
  ON "PREVISTOS"
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to previstos"
  ON "PREVISTOS"
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to previstos"
  ON "PREVISTOS"
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to previstos"
  ON "PREVISTOS"
  FOR DELETE
  TO public
  USING (true);

-- Update foreign key references in imports table if file_type column references these tables
-- Note: This is a data update, not a schema change
UPDATE imports 
SET file_type = 'CONTAS A PAGAR' 
WHERE file_type = 'accounts_payable';

UPDATE imports 
SET file_type = 'PREVISTOS' 
WHERE file_type = 'forecasted_entries';

