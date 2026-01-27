/*
  # Corrigir tabela de Orçamento DRE e Criar tabela de Faturamento DRE
  
  1. Correção da tabela orcamento_dre (dre_budget)
    - Adicionar `deleted_at` para soft delete
    - Adicionar `import_id` para rastreamento de importações (verificando tipo correto)
    - Corrigir políticas RLS para seguir padrão das outras tabelas DRE
    - Adicionar índice em `deleted_at`
    - Renomear de `dre_budget` para `orcamento_dre` se necessário
  
  2. Nova Tabela - faturamento_dre
    - `id` (uuid, primary key)
    - `business_unit` (text) - Unidade de negócio
    - `issue_date` (date) - Data de emissão
    - `amount` (numeric) - Valor
    - `import_id` (tipo dinâmico baseado na tabela de importações) - ID do lote de importação
    - `created_at` (timestamptz) - Data de criação
    - `updated_at` (timestamptz) - Data de atualização
    - `deleted_at` (timestamptz) - Data de exclusão (soft delete)
  
  3. Segurança
    - Habilitar RLS nas tabelas
    - Adicionar políticas para acesso público (anon e authenticated)
*/

-- ============================================
-- PARTE 1: Corrigir tabela orcamento_dre
-- ============================================

-- Renomear dre_budget para orcamento_dre se ainda não foi renomeado
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dre_budget') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orcamento_dre') THEN
    ALTER TABLE dre_budget RENAME TO orcamento_dre;
    
    -- Renomear índices
    ALTER INDEX IF EXISTS idx_dre_budget_business_unit RENAME TO idx_orcamento_dre_business_unit;
    ALTER INDEX IF EXISTS idx_dre_budget_period_date RENAME TO idx_orcamento_dre_period_date;
    ALTER INDEX IF EXISTS idx_dre_budget_account RENAME TO idx_orcamento_dre_account;
    ALTER INDEX IF EXISTS idx_dre_budget_unique RENAME TO idx_orcamento_dre_unique;
  END IF;
END $$;

-- Adicionar coluna deleted_at se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orcamento_dre' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE orcamento_dre ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Adicionar coluna import_id se não existir (verificando tipo correto)
DO $$ 
DECLARE
  import_table_name text;
  import_id_type text;
BEGIN
  -- Verificar se a coluna já existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orcamento_dre' AND column_name = 'import_id'
  ) THEN
    -- Verificar qual tabela existe e qual o tipo da coluna id
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'importacoes') THEN
      import_table_name := 'importacoes';
      -- Verificar o tipo da coluna id
      SELECT data_type INTO import_id_type
      FROM information_schema.columns
      WHERE table_name = 'importacoes' AND column_name = 'id';
      
      -- Adicionar coluna com o tipo correto
      IF import_id_type = 'bigint' THEN
        ALTER TABLE orcamento_dre ADD COLUMN import_id bigint;
        ALTER TABLE orcamento_dre 
        ADD CONSTRAINT fk_orcamento_dre_import_id 
        FOREIGN KEY (import_id) REFERENCES importacoes(id) ON DELETE SET NULL;
      ELSIF import_id_type = 'uuid' THEN
        ALTER TABLE orcamento_dre ADD COLUMN import_id uuid;
        ALTER TABLE orcamento_dre 
        ADD CONSTRAINT fk_orcamento_dre_import_id 
        FOREIGN KEY (import_id) REFERENCES importacoes(id) ON DELETE SET NULL;
      END IF;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imports') THEN
      import_table_name := 'imports';
      -- Verificar o tipo da coluna id
      SELECT data_type INTO import_id_type
      FROM information_schema.columns
      WHERE table_name = 'imports' AND column_name = 'id';
      
      -- Adicionar coluna com o tipo correto
      IF import_id_type = 'bigint' THEN
        ALTER TABLE orcamento_dre ADD COLUMN import_id bigint;
        ALTER TABLE orcamento_dre 
        ADD CONSTRAINT fk_orcamento_dre_import_id 
        FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE SET NULL;
      ELSIF import_id_type = 'uuid' THEN
        ALTER TABLE orcamento_dre ADD COLUMN import_id uuid;
        ALTER TABLE orcamento_dre 
        ADD CONSTRAINT fk_orcamento_dre_import_id 
        FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- Remover políticas antigas e criar novas seguindo o padrão
DROP POLICY IF EXISTS "Allow all access to orcamento_dre" ON orcamento_dre;
DROP POLICY IF EXISTS "Allow all access to dre_budget" ON orcamento_dre;
DROP POLICY IF EXISTS "Users can view orcamento_dre data" ON orcamento_dre;
DROP POLICY IF EXISTS "Users can insert orcamento_dre data" ON orcamento_dre;
DROP POLICY IF EXISTS "Users can update orcamento_dre data" ON orcamento_dre;
DROP POLICY IF EXISTS "Users can delete orcamento_dre data" ON orcamento_dre;
DROP POLICY IF EXISTS "Allow anon to view orcamento_dre" ON orcamento_dre;
DROP POLICY IF EXISTS "Allow anon to insert orcamento_dre" ON orcamento_dre;
DROP POLICY IF EXISTS "Allow anon to update orcamento_dre" ON orcamento_dre;
DROP POLICY IF EXISTS "Allow anon to delete orcamento_dre" ON orcamento_dre;

-- Criar políticas seguindo o padrão das outras tabelas DRE
CREATE POLICY "Allow anon to view orcamento_dre"
  ON orcamento_dre
  FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Allow anon to insert orcamento_dre"
  ON orcamento_dre
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update orcamento_dre"
  ON orcamento_dre
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete orcamento_dre"
  ON orcamento_dre
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Adicionar índice em deleted_at
CREATE INDEX IF NOT EXISTS idx_orcamento_dre_deleted_at ON orcamento_dre(deleted_at);

-- Adicionar índice em import_id se não existir
CREATE INDEX IF NOT EXISTS idx_orcamento_dre_import_id ON orcamento_dre(import_id);

-- ============================================
-- PARTE 2: Criar tabela faturamento_dre
-- ============================================

CREATE TABLE IF NOT EXISTS faturamento_dre (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit text NOT NULL,
  issue_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Adicionar coluna import_id com tipo dinâmico baseado na tabela de importações
DO $$
DECLARE
  import_table_name text;
  import_id_type text;
BEGIN
  -- Verificar qual tabela existe e qual o tipo da coluna id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'importacoes') THEN
    import_table_name := 'importacoes';
    -- Verificar o tipo da coluna id
    SELECT data_type INTO import_id_type
    FROM information_schema.columns
    WHERE table_name = 'importacoes' AND column_name = 'id';
    
    -- Adicionar coluna com o tipo correto
    IF import_id_type = 'bigint' THEN
      ALTER TABLE faturamento_dre ADD COLUMN import_id bigint;
      ALTER TABLE faturamento_dre 
      ADD CONSTRAINT fk_faturamento_dre_import_id 
      FOREIGN KEY (import_id) REFERENCES importacoes(id) ON DELETE CASCADE;
    ELSIF import_id_type = 'uuid' THEN
      ALTER TABLE faturamento_dre ADD COLUMN import_id uuid;
      ALTER TABLE faturamento_dre 
      ADD CONSTRAINT fk_faturamento_dre_import_id 
      FOREIGN KEY (import_id) REFERENCES importacoes(id) ON DELETE CASCADE;
    END IF;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imports') THEN
    import_table_name := 'imports';
    -- Verificar o tipo da coluna id
    SELECT data_type INTO import_id_type
    FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'id';
    
    -- Adicionar coluna com o tipo correto
    IF import_id_type = 'bigint' THEN
      ALTER TABLE faturamento_dre ADD COLUMN import_id bigint;
      ALTER TABLE faturamento_dre 
      ADD CONSTRAINT fk_faturamento_dre_import_id 
      FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE;
    ELSIF import_id_type = 'uuid' THEN
      ALTER TABLE faturamento_dre ADD COLUMN import_id uuid;
      ALTER TABLE faturamento_dre 
      ADD CONSTRAINT fk_faturamento_dre_import_id 
      FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

ALTER TABLE faturamento_dre ENABLE ROW LEVEL SECURITY;

-- Políticas RLS seguindo o padrão das outras tabelas DRE
CREATE POLICY "Allow anon to view faturamento_dre"
  ON faturamento_dre
  FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Allow anon to insert faturamento_dre"
  ON faturamento_dre
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update faturamento_dre"
  ON faturamento_dre
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete faturamento_dre"
  ON faturamento_dre
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_faturamento_dre_issue_date ON faturamento_dre(issue_date);
CREATE INDEX IF NOT EXISTS idx_faturamento_dre_business_unit ON faturamento_dre(business_unit);
CREATE INDEX IF NOT EXISTS idx_faturamento_dre_import_id ON faturamento_dre(import_id);
CREATE INDEX IF NOT EXISTS idx_faturamento_dre_deleted_at ON faturamento_dre(deleted_at);
