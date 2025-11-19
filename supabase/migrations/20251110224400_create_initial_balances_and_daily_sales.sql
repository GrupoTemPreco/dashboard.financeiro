/*
  # Create Initial Balances and Daily Sales Tables

  1. New Tables
    - `initial_balances`
      - `id` (uuid, primary key)
      - `business_unit` (text) - unidade de negócio
      - `account_name` (text) - nome da conta
      - `balance` (numeric) - saldo inicial
      - `date` (date) - data do saldo
      - `created_at` (timestamptz)
    
    - `daily_sales_forecast`
      - `id` (uuid, primary key)
      - `business_unit` (text) - unidade de negócio
      - `daily_amount` (numeric) - valor de venda diária prevista
      - `start_date` (date) - data inicial
      - `end_date` (date) - data final (opcional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS initial_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit text NOT NULL,
  account_name text NOT NULL DEFAULT 'Conta Principal',
  balance numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_sales_forecast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit text NOT NULL,
  daily_amount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE initial_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales_forecast ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on initial_balances"
  ON initial_balances
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on daily_sales_forecast"
  ON daily_sales_forecast
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_initial_balances_business_unit ON initial_balances(business_unit);
CREATE INDEX IF NOT EXISTS idx_daily_sales_business_unit ON daily_sales_forecast(business_unit);
