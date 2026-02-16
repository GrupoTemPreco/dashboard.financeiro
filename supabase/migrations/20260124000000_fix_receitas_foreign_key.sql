/*
  # Corrigir Foreign Key da tabela receitas
  
  1. Problema
    - A foreign key `revenues_import_id_fkey` pode não ter ON DELETE CASCADE
    - Isso impede deletar registros da tabela importacoes quando há registros em receitas referenciando
    
  2. Solução
    - Dropar a constraint antiga se existir
    - Recriar a constraint com ON DELETE CASCADE
    - Verificar se a tabela se chama receitas ou revenues
*/

-- Verificar e corrigir foreign key para receitas
DO $$
BEGIN
  -- Verificar se a tabela receitas existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receitas') THEN
    -- Dropar constraint antiga se existir (pode ter nomes diferentes)
    ALTER TABLE receitas DROP CONSTRAINT IF EXISTS revenues_import_id_fkey;
    ALTER TABLE receitas DROP CONSTRAINT IF EXISTS receitas_import_id_fkey;
    ALTER TABLE receitas DROP CONSTRAINT IF EXISTS receitas_import_id_importacoes_id_fkey;
    
    -- Recriar constraint com ON DELETE CASCADE
    -- Verificar se a tabela de imports se chama importacoes ou imports
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'importacoes') THEN
      ALTER TABLE receitas 
      ADD CONSTRAINT receitas_import_id_fkey 
      FOREIGN KEY (import_id) REFERENCES importacoes(id) ON DELETE CASCADE;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imports') THEN
      ALTER TABLE receitas 
      ADD CONSTRAINT receitas_import_id_fkey 
      FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE;
    END IF;
    
    RAISE NOTICE 'Foreign key corrigida para tabela receitas';
  END IF;
  
  -- Verificar se a tabela revenues ainda existe (caso não tenha sido renomeada)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenues') THEN
    -- Dropar constraint antiga se existir
    ALTER TABLE revenues DROP CONSTRAINT IF EXISTS revenues_import_id_fkey;
    
    -- Recriar constraint com ON DELETE CASCADE
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'importacoes') THEN
      ALTER TABLE revenues 
      ADD CONSTRAINT revenues_import_id_fkey 
      FOREIGN KEY (import_id) REFERENCES importacoes(id) ON DELETE CASCADE;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'imports') THEN
      ALTER TABLE revenues 
      ADD CONSTRAINT revenues_import_id_fkey 
      FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE;
    END IF;
    
    RAISE NOTICE 'Foreign key corrigida para tabela revenues';
  END IF;
END $$;
