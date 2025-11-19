/*
  # Create Forecasted Entries Table

  1. New Tables
    - `forecasted_entries`
      - `id` (uuid, primary key)
      - `status` (text) - paga/pendente
      - `business_unit` (text) - Unidade de negócio
      - `chart_of_accounts` (text) - Plano de contas
      - `supplier` (text) - Credor/fornecedor
      - `due_date` (date) - Data de vencimento
      - `amount` (numeric) - Valor
      - `import_id` (uuid) - ID da importação
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `forecasted_entries` table
    - Add policies for public access (temporary for development)
*/

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