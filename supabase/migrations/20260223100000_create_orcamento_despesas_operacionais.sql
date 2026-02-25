/*
  # Tabela orcamento_despesas_operacionais

  Orçamento e orçamento estratégico por conta (prefixo) e período para a tabela de Despesas Operacionais.
  Fonte única de orçamento editável na tela; salvo direto nesta tabela.

  Colunas:
  - id (uuid, PK)
  - account_key (text) - identificador da conta (ex.: prefixo '03.1', '03.2', '03.3')
  - period (date) - primeiro dia do mês (ex.: 2025-02-01)
  - orcamento (numeric) - orçamento
  - orcamento_estrategico (numeric) - orçamento estratégico
  - business_unit (text, opcional) - unidade de negócio quando orçamento for por unidade
  - created_at, updated_at
*/

CREATE TABLE IF NOT EXISTS orcamento_despesas_operacionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL,
  period date NOT NULL,
  orcamento numeric NOT NULL DEFAULT 0,
  orcamento_estrategico numeric NOT NULL DEFAULT 0,
  business_unit text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (account_key, period)
);

COMMENT ON TABLE orcamento_despesas_operacionais IS 'Orçamento e orçamento estratégico por conta (account_key) e período para Despesas Operacionais';
COMMENT ON COLUMN orcamento_despesas_operacionais.account_key IS 'Identificador da conta (ex.: prefixo do chart_of_accounts 03.1, 03.2)';
COMMENT ON COLUMN orcamento_despesas_operacionais.period IS 'Primeiro dia do mês (YYYY-MM-01)';
COMMENT ON COLUMN orcamento_despesas_operacionais.orcamento IS 'Orçamento editável na tela';
COMMENT ON COLUMN orcamento_despesas_operacionais.orcamento_estrategico IS 'Orçamento estratégico';

CREATE INDEX IF NOT EXISTS idx_orcamento_desp_op_account_period
  ON orcamento_despesas_operacionais (account_key, period);

ALTER TABLE orcamento_despesas_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to orcamento_despesas_operacionais"
  ON orcamento_despesas_operacionais
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION set_updated_at_orcamento_desp_op()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orcamento_despesas_operacionais_updated_at ON orcamento_despesas_operacionais;
CREATE TRIGGER orcamento_despesas_operacionais_updated_at
  BEFORE UPDATE ON orcamento_despesas_operacionais
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at_orcamento_desp_op();
