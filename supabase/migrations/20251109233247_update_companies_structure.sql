/*
  # Update Companies Table Structure

  1. Changes
    - Add `company_code` column (unique identifier for companies)
    - Add `company_name` column (replaces `name`)
    - Add `group_name` column (company group)
    - Remove dependency on `user_id` for easier data import
    - Update RLS policies to allow public access (no authentication required)

  2. Notes
    - This allows importing company data without authentication
    - Maintains data integrity with unique company codes
*/

-- Add new columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_code'
  ) THEN
    ALTER TABLE companies ADD COLUMN company_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN company_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'group_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN group_name text;
  END IF;
END $$;

-- Make user_id nullable for easier import
ALTER TABLE companies ALTER COLUMN user_id DROP NOT NULL;

-- Add unique constraint on company_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'companies_company_code_key'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_company_code_key UNIQUE (company_code);
  END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own companies" ON companies;
DROP POLICY IF EXISTS "Users can insert own companies" ON companies;
DROP POLICY IF EXISTS "Users can update own companies" ON companies;
DROP POLICY IF EXISTS "Users can delete own companies" ON companies;

-- Create new permissive policies for easier import
CREATE POLICY "Allow all access to companies"
  ON companies FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);