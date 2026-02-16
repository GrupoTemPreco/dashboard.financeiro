-- ============================================
-- INVESTIGAÇÃO: Registros na tabela vs planilha
-- ============================================

-- QUERY 1: Total de registros na tabela
SELECT 
  'Total na tabela' as descricao,
  COUNT(*) as quantidade
FROM "CONTAS A PAGAR";

-- QUERY 2: Registros agrupados por import_id (para ver de onde vieram)
SELECT 
  import_id,
  COUNT(*) as quantidade,
  MIN(created_at) as primeira_importacao,
  MAX(created_at) as ultima_importacao,
  SUM(amount) as soma_total
FROM "CONTAS A PAGAR"
GROUP BY import_id
ORDER BY quantidade DESC;

-- QUERY 3: Verificar registros sem import_id (se houver)
SELECT 
  'Registros sem import_id' as tipo,
  COUNT(*) as quantidade,
  SUM(amount) as soma_total
FROM "CONTAS A PAGAR"
WHERE import_id IS NULL;

-- QUERY 4: Verificar registros duplicados (mesmos dados, diferentes IDs)
SELECT 
  business_unit,
  creditor,
  chart_of_accounts,
  payment_date,
  due_date,
  amount,
  status,
  COUNT(*) as quantidade_duplicados,
  STRING_AGG(id::text, ', ') as ids
FROM "CONTAS A PAGAR"
GROUP BY business_unit, creditor, chart_of_accounts, payment_date, due_date, amount, status
HAVING COUNT(*) > 1
ORDER BY quantidade_duplicados DESC
LIMIT 50;

-- QUERY 5: Verificar registros com import_id de imports deletados
SELECT 
  'Registros de imports deletados' as tipo,
  COUNT(*) as quantidade,
  SUM(amount) as soma_total
FROM "CONTAS A PAGAR" ap
WHERE ap.import_id IN (
  SELECT id FROM importacoes WHERE is_deleted = true
);

-- QUERY 6: Comparar registros por status
SELECT 
  status,
  COUNT(*) as quantidade,
  SUM(amount) as soma_total
FROM "CONTAS A PAGAR"
GROUP BY status
ORDER BY status;

-- QUERY 7: Verificar últimos imports e quantos registros cada um tem
SELECT 
  i.id,
  i.file_name,
  i.file_type,
  i.imported_at,
  i.record_count as registros_esperados,
  COUNT(ap.id) as registros_reais,
  i.record_count - COUNT(ap.id) as diferenca,
  i.is_deleted
FROM importacoes i
LEFT JOIN "CONTAS A PAGAR" ap ON ap.import_id = i.id
WHERE i.file_type = 'contas_a_pagar'
GROUP BY i.id, i.file_name, i.file_type, i.imported_at, i.record_count, i.is_deleted
ORDER BY i.imported_at DESC
LIMIT 20;

-- QUERY 8: Verificar se há registros com payment_date NULL que não deveriam ter
SELECT 
  'Registros com payment_date NULL e status realizado' as tipo,
  COUNT(*) as quantidade,
  SUM(amount) as soma_total
FROM "CONTAS A PAGAR"
WHERE payment_date IS NULL 
  AND status = 'realizado';

-- QUERY 9: Verificar registros com valores zero ou nulos
SELECT 
  'Registros com amount zero ou NULL' as tipo,
  COUNT(*) as quantidade
FROM "CONTAS A PAGAR"
WHERE amount IS NULL OR amount = 0;

-- QUERY 10: Verificar se há registros órfãos (sem import_id válido)
SELECT 
  'Registros órfãos (sem import_id válido)' as tipo,
  COUNT(*) as quantidade,
  SUM(amount) as soma_total
FROM "CONTAS A PAGAR" ap
WHERE ap.import_id IS NULL 
   OR ap.import_id NOT IN (SELECT id FROM importacoes);

-- QUERY 11: Comparar total esperado vs total real
SELECT 
  (SELECT COUNT(*) FROM "CONTAS A PAGAR") as total_na_tabela,
  (SELECT SUM(record_count) FROM importacoes WHERE file_type = 'contas_a_pagar' AND is_deleted = false) as total_esperado_imports_ativos,
  (SELECT COUNT(*) FROM "CONTAS A PAGAR" WHERE import_id IN (SELECT id FROM importacoes WHERE is_deleted = false)) as total_de_imports_ativos,
  (SELECT COUNT(*) FROM "CONTAS A PAGAR" WHERE import_id IS NULL OR import_id NOT IN (SELECT id FROM importacoes)) as registros_orfos;

-- QUERY 12: Verificar se há registros duplicados exatos (mesma linha importada múltiplas vezes)
SELECT 
  business_unit,
  creditor,
  chart_of_accounts,
  COALESCE(payment_date::text, 'NULL') as payment_date,
  COALESCE(due_date::text, 'NULL') as due_date,
  amount,
  status,
  COUNT(*) as quantidade_duplicados,
  STRING_AGG(import_id::text, ', ') as import_ids,
  STRING_AGG(id::text, ', ') as ids
FROM "CONTAS A PAGAR"
GROUP BY business_unit, creditor, chart_of_accounts, payment_date, due_date, amount, status
HAVING COUNT(*) > 1
ORDER BY quantidade_duplicados DESC
LIMIT 100;
