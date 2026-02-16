-- Adicionar novas colunas à tabela transacoes_financeiras
-- Colunas existentes (mapeadas): business_unit, chart_of_accounts, transaction_date, amount
-- Novas colunas: num_doc, conta_corrente, origem, descricao, data_hora_inclusao, usuario

ALTER TABLE transacoes_financeiras
  ADD COLUMN IF NOT EXISTS num_doc text,
  ADD COLUMN IF NOT EXISTS conta_corrente text,
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS data_hora_inclusao timestamptz,
  ADD COLUMN IF NOT EXISTS usuario text;

-- Status pode ser NULL (não precisa de DEFAULT)
ALTER TABLE transacoes_financeiras
  ALTER COLUMN status DROP NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN transacoes_financeiras.num_doc IS 'Número do documento';
COMMENT ON COLUMN transacoes_financeiras.conta_corrente IS 'Conta corrente';
COMMENT ON COLUMN transacoes_financeiras.origem IS 'Origem da transação';
COMMENT ON COLUMN transacoes_financeiras.descricao IS 'Descrição da transação';
COMMENT ON COLUMN transacoes_financeiras.data_hora_inclusao IS 'Data e hora de inclusão';
COMMENT ON COLUMN transacoes_financeiras.usuario IS 'Usuário responsável';
COMMENT ON COLUMN transacoes_financeiras.status IS 'Status da transação (realizado/previsto) - pode ser NULL';
