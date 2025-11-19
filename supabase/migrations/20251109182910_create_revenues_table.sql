/*
  # Create revenues table

  1. New Tables
    - `revenues`
      - `id` (uuid, primary key) - Unique identifier for each revenue record
      - `status` (text) - Status of the revenue (pendente/recebida)
      - `business_unit` (text) - Business unit/unidade de negócio
      - `chart_of_accounts` (text) - Chart of accounts/plano de contas
      - `payment_date` (date) - Payment date/data de pagamento
      - `amount` (numeric) - Revenue amount/valor
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  2. Security
    - Enable RLS on `revenues` table
    - Add policy for authenticated users to read all revenues
    - Add policy for authenticated users to insert revenues
    - Add policy for authenticated users to update revenues
    - Add policy for authenticated users to delete revenues

  3. Important Notes
    - Status can be 'pendente' (forecasted) or 'recebida' (actual/received)
    - Amount is stored as numeric for precision
    - All timestamps use timestamptz for timezone awareness
*/

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

CREATE POLICY "Users can read all revenues"
  ON revenues
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert revenues"
  ON revenues
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update revenues"
  ON revenues
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete revenues"
  ON revenues
  FOR DELETE
  TO authenticated
  USING (true);