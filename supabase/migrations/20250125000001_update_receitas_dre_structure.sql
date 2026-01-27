/*
  # Atualizar estrutura da tabela receitas_dre
  
  1. Mudanças:
    - Tornar `status` opcional (com valor padrão 'recebida')
    - Tornar `chart_of_accounts` opcional (com valor padrão 'Receita Bruta')
    - Isso permite que o formato simplificado (Unidade | Data | Valor) funcione
  
  2. Notas:
    - Os campos antigos continuam funcionando para compatibilidade
    - Novos registros sem esses campos usarão os valores padrão
*/

-- Tornar status opcional com valor padrão
ALTER TABLE receitas_dre 
  ALTER COLUMN status DROP NOT NULL,
  ALTER COLUMN status SET DEFAULT 'recebida';

-- Tornar chart_of_accounts opcional com valor padrão
ALTER TABLE receitas_dre 
  ALTER COLUMN chart_of_accounts DROP NOT NULL,
  ALTER COLUMN chart_of_accounts SET DEFAULT 'Receita Bruta';

-- Atualizar registros existentes que possam ter NULL
UPDATE receitas_dre 
SET status = COALESCE(status, 'recebida'),
    chart_of_accounts = COALESCE(chart_of_accounts, 'Receita Bruta')
WHERE status IS NULL OR chart_of_accounts IS NULL;
