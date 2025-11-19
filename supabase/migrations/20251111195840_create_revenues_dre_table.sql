/*
  # Criar tabela de Receitas DRE
  
  1. Nova Tabela
    - `revenues_dre`
      - `id` (uuid, primary key)
      - `status` (text) - Status: recebida ou pendente
      - `business_unit` (text) - Unidade de negócio
      - `chart_of_accounts` (text) - Plano de contas
      - `issue_date` (date) - Data de emissão
      - `amount` (numeric) - Valor
      - `import_id` (uuid) - ID do lote de importação
      - `created_at` (timestamptz) - Data de criação
      - `updated_at` (timestamptz) - Data de atualização
  
  2. Segurança
    - Habilitar RLS na tabela `revenues_dre`
    - Adicionar políticas para usuários autenticados
*/

CREATE TABLE IF NOT EXISTS revenues_dre (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  business_unit text NOT NULL,
  chart_of_accounts text NOT NULL,
  issue_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  import_id uuid REFERENCES imports(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE revenues_dre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view revenues_dre data"
  ON revenues_dre
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert revenues_dre data"
  ON revenues_dre
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update revenues_dre data"
  ON revenues_dre
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete revenues_dre data"
  ON revenues_dre
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_revenues_dre_issue_date ON revenues_dre(issue_date);
CREATE INDEX IF NOT EXISTS idx_revenues_dre_business_unit ON revenues_dre(business_unit);
CREATE INDEX IF NOT EXISTS idx_revenues_dre_import_id ON revenues_dre(import_id);
CREATE INDEX IF NOT EXISTS idx_revenues_dre_status ON revenues_dre(status);
