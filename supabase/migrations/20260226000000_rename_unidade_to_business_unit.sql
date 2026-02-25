/*
  Padronizar coluna de unidade/loja para business_unit (company_code) em:
  - receitas_manuais: unidade -> business_unit
  - receita_crediario: un_neg_receb -> business_unit
  Assim o filtro por empresa usa sempre company_code.
*/

-- receitas_manuais: renomear unidade para business_unit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'receitas_manuais' AND column_name = 'unidade'
  ) THEN
    ALTER TABLE receitas_manuais RENAME COLUMN unidade TO business_unit;
  END IF;
END $$;

-- Atualizar índice se existir com nome antigo
DROP INDEX IF EXISTS idx_receitas_manuais_unidade;
CREATE INDEX IF NOT EXISTS idx_receitas_manuais_business_unit ON receitas_manuais(business_unit);

-- Índice composto (import_id, unidade, data) passa a (import_id, business_unit, data)
DROP INDEX IF EXISTS idx_receitas_manuais_import_unidade_data;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'receitas_manuais' AND column_name = 'import_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_receitas_manuais_import_business_unit_data
      ON receitas_manuais(import_id, business_unit, data);
  END IF;
END $$;

-- receita_crediario: renomear un_neg_receb para business_unit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'receita_crediario' AND column_name = 'un_neg_receb'
  ) THEN
    ALTER TABLE receita_crediario RENAME COLUMN un_neg_receb TO business_unit;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_receita_crediario_un_neg_receb;
CREATE INDEX IF NOT EXISTS idx_receita_crediario_business_unit ON receita_crediario(business_unit);
