-- Query para verificar soma de Contas a Pagar
-- Ajuste as datas conforme necessário (exemplo: janeiro 2025)

-- ============================================
-- CONFIGURAÇÃO: Ajuste essas datas
-- ============================================
-- Para janeiro 2025:
-- startDate = '2025-01-01'
-- endDate = '2025-01-31'

-- ============================================
-- QUERY 1: Soma total considerando payment_date OU due_date
-- ============================================
SELECT 
  'Total Geral' as tipo,
  COUNT(*) as total_registros,
  SUM(amount) as soma_total,
  SUM(CASE WHEN status = 'realizado' THEN amount ELSE 0 END) as soma_realizado,
  SUM(CASE WHEN status = 'previsto' THEN amount ELSE 0 END) as soma_previsto
FROM "CONTAS A PAGAR"
WHERE 
  -- Registros com payment_date no período (status realizado)
  (payment_date >= '2025-01-01' AND payment_date <= '2025-01-31')
  OR
  -- Registros sem payment_date mas com due_date no período (status previsto)
  (payment_date IS NULL AND due_date >= '2025-01-01' AND due_date <= '2025-01-31');

-- ============================================
-- QUERY 2: Detalhamento por status
-- ============================================
SELECT 
  status,
  COUNT(*) as quantidade,
  SUM(amount) as soma,
  MIN(amount) as valor_minimo,
  MAX(amount) as valor_maximo,
  AVG(amount) as valor_medio
FROM "CONTAS A PAGAR"
WHERE 
  (payment_date >= '2025-01-01' AND payment_date <= '2025-01-31')
  OR
  (payment_date IS NULL AND due_date >= '2025-01-01' AND due_date <= '2025-01-31')
GROUP BY status
ORDER BY status;

-- ============================================
-- QUERY 3: Verificar registros sem payment_date
-- ============================================
SELECT 
  'Registros sem payment_date' as tipo,
  COUNT(*) as quantidade,
  SUM(amount) as soma_total
FROM "CONTAS A PAGAR"
WHERE 
  payment_date IS NULL
  AND due_date >= '2025-01-01' 
  AND due_date <= '2025-01-31';

-- ============================================
-- QUERY 4: Comparação - apenas payment_date vs payment_date + due_date
-- ============================================
SELECT 
  'Apenas payment_date' as metodo,
  COUNT(*) as registros,
  SUM(amount) as soma
FROM "CONTAS A PAGAR"
WHERE payment_date >= '2025-01-01' AND payment_date <= '2025-01-31'

UNION ALL

SELECT 
  'payment_date OU due_date (NULL)' as metodo,
  COUNT(*) as registros,
  SUM(amount) as soma
FROM "CONTAS A PAGAR"
WHERE 
  (payment_date >= '2025-01-01' AND payment_date <= '2025-01-31')
  OR
  (payment_date IS NULL AND due_date >= '2025-01-01' AND due_date <= '2025-01-31');
