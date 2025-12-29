-- Script para renomear tabelas do Supabase de inglês para português
-- Execute estes comandos no SQL Editor do Supabase

-- IMPORTANTE: Faça backup antes de executar!
-- Execute os comandos na ordem apresentada

-- 1. Renomear tabelas principais
ALTER TABLE companies RENAME TO empresas;
ALTER TABLE revenues RENAME TO receitas;
ALTER TABLE financial_transactions RENAME TO transacoes_financeiras;
ALTER TABLE revenues_dre RENAME TO receitas_dre;
ALTER TABLE initial_balances RENAME TO saldos_iniciais;
ALTER TABLE imports RENAME TO importacoes;
ALTER TABLE dre_budget RENAME TO orcamento_dre;

-- 2. Normalizar nomes das tabelas que já estavam em português (remover espaços e maiúsculas)
-- Nota: Se as tabelas "CONTAS A PAGAR" e "PREVISTOS" já existem com esses nomes exatos,
-- você pode precisar usar aspas duplas. Verifique primeiro no Supabase.

-- Se a tabela se chama exatamente "CONTAS A PAGAR" (com aspas):
ALTER TABLE "CONTAS A PAGAR" RENAME TO contas_a_pagar;

-- Se a tabela se chama exatamente "PREVISTOS" (com aspas):
ALTER TABLE "PREVISTOS" RENAME TO previstos;

-- 3. Verificar se há foreign keys ou constraints que precisam ser atualizadas
-- (O PostgreSQL geralmente atualiza automaticamente, mas é bom verificar)

-- Para verificar constraints após a renomeação:
-- SELECT conname, conrelid::regclass, confrelid::regclass 
-- FROM pg_constraint 
-- WHERE contype = 'f';

-- 4. Verificar se há índices que precisam ser atualizados
-- (Índices são atualizados automaticamente, mas você pode verificar)
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';

