-- =============================================================================
-- Conferência: totais de contas_a_pagar em fevereiro (mesma regra do app)
-- =============================================================================
-- Regra do app:
--   Realizado = payment_date no período + status realizado/pago
--   Previsto  = due_date no período + status pendente/previsto
-- Troque 2026-02-01 e 2026-02-29 se for outro mês/ano.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Totais: previsto_soma (por due_date), realizado_soma (por payment_date)
-- -----------------------------------------------------------------------------
SELECT
  (SELECT COALESCE(SUM(ABS(amount)), 0)
   FROM contas_a_pagar
   WHERE import_id IN (SELECT id FROM importacoes WHERE is_deleted = false)
     AND LOWER(TRIM(COALESCE(status, ''))) IN ('previsto', 'pendente')
     AND due_date >= '2026-02-01' AND due_date <= '2026-02-29') AS previsto_soma,
  (SELECT COALESCE(SUM(ABS(amount)), 0)
   FROM contas_a_pagar
   WHERE import_id IN (SELECT id FROM importacoes WHERE is_deleted = false)
     AND LOWER(TRIM(COALESCE(status, ''))) IN ('realizado', 'pago')
     AND payment_date >= '2026-02-01' AND payment_date <= '2026-02-29') AS realizado_soma;

-- -----------------------------------------------------------------------------
-- 2) Detalhe: qtd e soma por critério (previsto por due_date, realizado por payment_date)
-- -----------------------------------------------------------------------------
SELECT 'previsto (due_date em fev)' AS criterio,
       COUNT(*) AS qtd,
       SUM(ABS(COALESCE(amount, 0))) AS soma
FROM contas_a_pagar
WHERE import_id IN (SELECT id FROM importacoes WHERE is_deleted = false)
  AND LOWER(TRIM(COALESCE(status, ''))) IN ('previsto', 'pendente')
  AND due_date >= '2026-02-01' AND due_date <= '2026-02-29'
UNION ALL
SELECT 'realizado (payment_date em fev)' AS criterio,
       COUNT(*) AS qtd,
       SUM(ABS(COALESCE(amount, 0))) AS soma
FROM contas_a_pagar
WHERE import_id IN (SELECT id FROM importacoes WHERE is_deleted = false)
  AND LOWER(TRIM(COALESCE(status, ''))) IN ('realizado', 'pago')
  AND payment_date >= '2026-02-01' AND payment_date <= '2026-02-29';
