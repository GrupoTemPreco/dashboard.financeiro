/*
  # Create Performance Indexes

  Cria índices compostos e simples para melhorar a performance das queries
  que filtram por import_id, business_unit (loja/grupo) e ordenam por data.

  1. Índices Compostos Principais (import_id + business_unit + data)
    - receitas: (import_id, business_unit, payment_date)
    - contas_a_pagar: (import_id, business_unit, payment_date)
    - transacoes_financeiras: (import_id, business_unit, transaction_date)
    - previstos: (import_id, business_unit, due_date)
    - cmv_dre: (import_id, business_unit, issue_date)
    - receitas_dre: (import_id, business_unit, issue_date)

  2. Índices Simples (apenas data para ordenação quando não há filtro de import_id)
    - payment_date em receitas e contas_a_pagar
    - transaction_date em transacoes_financeiras
    - due_date em previstos
    - issue_date em cmv_dre e receitas_dre
*/

-- Índices principais (os que mais ajudam no padrão: import + loja + data)
-- Esses índices compostos otimizam queries que filtram por import_id, business_unit e ordenam por data

CREATE INDEX IF NOT EXISTS idx_receitas_import_bu_payment_date
  ON receitas(import_id, business_unit, payment_date);

-- Índice para contas_a_pagar (verificar se foi renomeada para "CONTAS A PAGAR")
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CONTAS A PAGAR') THEN
    CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_import_bu_payment_date
      ON "CONTAS A PAGAR"(import_id, business_unit, payment_date);
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contas_a_pagar') THEN
    CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_import_bu_payment_date
      ON contas_a_pagar(import_id, business_unit, payment_date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transacoes_import_bu_transaction_date
  ON transacoes_financeiras(import_id, business_unit, transaction_date);

CREATE INDEX IF NOT EXISTS idx_previstos_import_bu_due_date
  ON previstos(import_id, business_unit, due_date);

CREATE INDEX IF NOT EXISTS idx_receitas_dre_import_bu_issue_date
  ON receitas_dre(import_id, business_unit, issue_date);

CREATE INDEX IF NOT EXISTS idx_cmv_dre_import_bu_issue_date
  ON cmv_dre(import_id, business_unit, issue_date);

-- Índices adicionais para ordenação apenas por data (quando não há filtro de import_id)
CREATE INDEX IF NOT EXISTS idx_receitas_payment_date 
  ON receitas(payment_date);

-- Índice simples para contas_a_pagar
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CONTAS A PAGAR') THEN
    CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_payment_date 
      ON "CONTAS A PAGAR"(payment_date);
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contas_a_pagar') THEN
    CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_payment_date 
      ON contas_a_pagar(payment_date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_transaction_date 
  ON transacoes_financeiras(transaction_date);

CREATE INDEX IF NOT EXISTS idx_previstos_due_date 
  ON previstos(due_date);

CREATE INDEX IF NOT EXISTS idx_cmv_dre_issue_date 
  ON cmv_dre(issue_date);

CREATE INDEX IF NOT EXISTS idx_receitas_dre_issue_date 
  ON receitas_dre(issue_date);

-- Índice para saldos_iniciais (usado no carregamento)
CREATE INDEX IF NOT EXISTS idx_saldos_iniciais_balance_date 
  ON saldos_iniciais(balance_date);

CREATE INDEX IF NOT EXISTS idx_saldos_iniciais_business_unit_balance_date 
  ON saldos_iniciais(business_unit, balance_date);
