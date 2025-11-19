/*
  # Create financial transactions table

  1. New Tables
    - `financial_transactions`
      - `id` (uuid, primary key) - Unique identifier for each transaction
      - `status` (text) - Status of the transaction (previsto/realizado)
      - `business_unit` (text) - Business unit/unidade de negócio
      - `chart_of_accounts` (text) - Chart of accounts/plano de contas
      - `transaction_date` (date) - Transaction date/data
      - `amount` (numeric) - Transaction amount/valor (positive or negative)
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  2. Security
    - Enable RLS on `financial_transactions` table
    - Add policy for authenticated users to read all transactions
    - Add policy for authenticated users to insert transactions
    - Add policy for authenticated users to update transactions
    - Add policy for authenticated users to delete transactions

  3. Important Notes
    - Status can be 'previsto' (forecasted) or 'realizado' (actual)
    - Amount can be positive (inflow/receita) or negative (outflow/pagamento)
    - Positive amounts feed into Total de Recebimentos KPI
    - Negative amounts feed into Total de Pagamentos KPI
    - Amount is stored as numeric for precision
    - All timestamps use timestamptz for timezone awareness
*/

CREATE TABLE IF NOT EXISTS financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'previsto',
  business_unit text NOT NULL,
  chart_of_accounts text NOT NULL,
  transaction_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all financial transactions"
  ON financial_transactions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert financial transactions"
  ON financial_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update financial transactions"
  ON financial_transactions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete financial transactions"
  ON financial_transactions
  FOR DELETE
  TO authenticated
  USING (true);