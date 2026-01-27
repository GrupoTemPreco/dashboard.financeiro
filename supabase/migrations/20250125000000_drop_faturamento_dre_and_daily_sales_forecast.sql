/*
  # Dropar tabelas não utilizadas
  
  1. Tabelas a serem removidas:
    - `faturamento_dre` - Duplicada de receitas_dre, não está sendo usada
    - `daily_sales_forecast` - Não tem importador e não está sendo usada
  
  2. Ações:
    - Dropar tabela faturamento_dre e todos os seus índices/constraints
    - Dropar tabela daily_sales_forecast e todos os seus índices/constraints
*/

-- Dropar tabela faturamento_dre
DROP TABLE IF EXISTS faturamento_dre CASCADE;

-- Dropar tabela daily_sales_forecast
DROP TABLE IF EXISTS daily_sales_forecast CASCADE;
