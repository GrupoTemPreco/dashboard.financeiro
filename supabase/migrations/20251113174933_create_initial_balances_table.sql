/*
  # Create Initial Balances Table

  1. New Tables
    - `initial_balances`
      - `id` (uuid, primary key)
      - `business_unit` (text) - unidade de negócio (código da empresa)
      - `bank_name` (text) - nome do banco
      - `balance` (numeric) - saldo inicial
      - `balance_date` (date) - data do saldo
      - `import_id` (uuid) - referência para rastreamento de importação
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on table
    - Add policies for anonymous and authenticated users

  3. Indexes
    - Index on business_unit for fast filtering
*/

CREATE TABLE IF NOT EXISTS initial_balances (
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

CREATE POLICY "Allow all access to initial_balances"
  ON initial_balances FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_initial_balances_business_unit ON initial_balances(business_unit);
CREATE INDEX IF NOT EXISTS idx_initial_balances_date ON initial_balances(balance_date);