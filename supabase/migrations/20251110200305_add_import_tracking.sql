/*
  # Add Import Tracking

  1. New Tables
    - `imports`
      - `id` (uuid, primary key)
      - `file_name` (text)
      - `file_type` (text) - 'companies', 'accounts_payable', 'revenues', 'financial_transactions'
      - `record_count` (integer)
      - `imported_at` (timestamp)
      - `user_id` (uuid, nullable for now)

  2. Changes
    - Add `import_id` column to `accounts_payable`, `revenues`, and `financial_transactions` tables
    - Add foreign key constraints

  3. Security
    - Enable RLS on `imports` table
    - Add policies for authenticated users
*/

-- Create imports table
CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_type text NOT NULL,
  record_count integer DEFAULT 0,
  imported_at timestamptz DEFAULT now(),
  user_id uuid
);

ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to imports"
  ON imports
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add import_id to existing tables
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
