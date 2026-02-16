-- Corrigir foreign key constraint na tabela transacoes_financeiras
-- para permitir exclusão em cascata quando importacoes for deletada

DO $$
DECLARE
  fk_name TEXT;
  table_name TEXT := 'transacoes_financeiras';
  imports_table_name TEXT := 'importacoes';
BEGIN
  -- Tenta encontrar o nome da tabela de importacoes/imports
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'importacoes') THEN
    imports_table_name := 'imports';
  END IF;

  -- Encontrar TODAS as foreign keys relacionadas a import_id
  -- Pode ter nomes diferentes: financial_transactions_import_id_fkey, transacoes_financeiras_import_id_fkey, etc.
  FOR fk_name IN 
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = table_name::regclass
      AND confrelid = imports_table_name::regclass
      AND contype = 'f'
      AND (
        conname LIKE '%import_id%' OR 
        conname LIKE '%financial_transactions%' OR
        conname LIKE '%transacoes_financeiras%'
      )
  LOOP
    -- Dropar cada foreign key encontrada
    EXECUTE 'ALTER TABLE ' || quote_ident(table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(fk_name);
    RAISE NOTICE 'Dropped existing foreign key constraint % on table %', fk_name, table_name;
  END LOOP;

  -- Verificar se a coluna import_id existe antes de criar a constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = table_name 
      AND column_name = 'import_id'
  ) THEN
    -- Adicionar a nova foreign key com ON DELETE CASCADE
    -- Usar um nome padrão para evitar conflitos
    BEGIN
      EXECUTE 'ALTER TABLE ' || quote_ident(table_name) || 
              ' ADD CONSTRAINT ' || quote_ident('transacoes_financeiras_import_id_fkey') || 
              ' FOREIGN KEY (import_id) REFERENCES ' || quote_ident(imports_table_name) || '(id) ON DELETE CASCADE';
      RAISE NOTICE 'Added foreign key constraint transacoes_financeiras_import_id_fkey on table % with ON DELETE CASCADE', table_name;
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint transacoes_financeiras_import_id_fkey already exists, skipping creation';
    END;
  ELSE
    RAISE NOTICE 'Column import_id does not exist on table %, skipping foreign key creation', table_name;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error modifying foreign key for table % referencing %: %', 
                  table_name, imports_table_name, SQLERRM;
END $$;
