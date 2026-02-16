-- Script para verificar as datas salvas na tabela CONTAS A PAGAR
-- Use este script para verificar quais datas foram realmente salvas no banco

-- 1. Verificar o range de datas (due_date e payment_date)
SELECT 
  'Range de Datas' as tipo,
  MIN(due_date) as data_minima,
  MAX(due_date) as data_maxima,
  COUNT(*) as total_registros
FROM "CONTAS A PAGAR"
UNION ALL
SELECT 
  'Range de payment_date (não nulos)' as tipo,
  MIN(payment_date)::text as data_minima,
  MAX(payment_date)::text as data_maxima,
  COUNT(*) as total_registros
FROM "CONTAS A PAGAR"
WHERE payment_date IS NOT NULL;

-- 2. Verificar registros por mês/ano (due_date)
SELECT 
  EXTRACT(YEAR FROM due_date) as ano,
  EXTRACT(MONTH FROM due_date) as mes,
  COUNT(*) as total_registros,
  SUM(amount) as soma_valores
FROM "CONTAS A PAGAR"
GROUP BY EXTRACT(YEAR FROM due_date), EXTRACT(MONTH FROM due_date)
ORDER BY ano DESC, mes DESC
LIMIT 12;

-- 3. Verificar registros por mês/ano (payment_date - apenas não nulos)
SELECT 
  EXTRACT(YEAR FROM payment_date) as ano,
  EXTRACT(MONTH FROM payment_date) as mes,
  COUNT(*) as total_registros,
  SUM(amount) as soma_valores
FROM "CONTAS A PAGAR"
WHERE payment_date IS NOT NULL
GROUP BY EXTRACT(YEAR FROM payment_date), EXTRACT(MONTH FROM payment_date)
ORDER BY ano DESC, mes DESC
LIMIT 12;

-- 4. Verificar registros para fevereiro de 2026 especificamente
SELECT 
  'Fevereiro 2026 - por due_date' as tipo,
  COUNT(*) as total_registros,
  SUM(amount) as soma_valores,
  COUNT(CASE WHEN payment_date IS NOT NULL THEN 1 END) as com_payment_date,
  COUNT(CASE WHEN payment_date IS NULL THEN 1 END) as sem_payment_date
FROM "CONTAS A PAGAR"
WHERE 
  (due_date >= '2026-02-01' AND due_date <= '2026-02-28')
  OR
  (payment_date >= '2026-02-01' AND payment_date <= '2026-02-28')
UNION ALL
SELECT 
  'Fevereiro 2026 - apenas payment_date' as tipo,
  COUNT(*) as total_registros,
  SUM(amount) as soma_valores,
  COUNT(CASE WHEN payment_date IS NOT NULL THEN 1 END) as com_payment_date,
  COUNT(CASE WHEN payment_date IS NULL THEN 1 END) as sem_payment_date
FROM "CONTAS A PAGAR"
WHERE payment_date >= '2026-02-01' AND payment_date <= '2026-02-28'
UNION ALL
SELECT 
  'Fevereiro 2026 - apenas due_date (sem payment_date)' as tipo,
  COUNT(*) as total_registros,
  SUM(amount) as soma_valores,
  COUNT(CASE WHEN payment_date IS NOT NULL THEN 1 END) as com_payment_date,
  COUNT(CASE WHEN payment_date IS NULL THEN 1 END) as sem_payment_date
FROM "CONTAS A PAGAR"
WHERE payment_date IS NULL
  AND due_date >= '2026-02-01' AND due_date <= '2026-02-28';

-- 5. Amostra de registros recentes (últimos 10)
SELECT 
  id,
  due_date,
  payment_date,
  status,
  amount,
  business_unit,
  creditor,
  created_at
FROM "CONTAS A PAGAR"
ORDER BY created_at DESC
LIMIT 10;

-- 6. Verificar se há registros com datas inválidas ou muito antigas/futuras
SELECT 
  'Datas inválidas ou suspeitas' as tipo,
  COUNT(*) as total
FROM "CONTAS A PAGAR"
WHERE 
  due_date < '2000-01-01' 
  OR due_date > '2100-01-01'
  OR (payment_date IS NOT NULL AND (payment_date < '2000-01-01' OR payment_date > '2100-01-01'));
