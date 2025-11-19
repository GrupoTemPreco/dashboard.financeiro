/*
  # Corrigir políticas RLS para revenues_dre
  
  1. Mudanças
    - Remover políticas antigas que exigem autenticação
    - Adicionar políticas que permitem acesso anônimo (anon)
    - Permitir todas as operações para usuários anônimos
  
  2. Segurança
    - As políticas permitem acesso completo para role anon
    - Adequado para ambiente de desenvolvimento/demo
*/

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view revenues_dre data" ON revenues_dre;
DROP POLICY IF EXISTS "Users can insert revenues_dre data" ON revenues_dre;
DROP POLICY IF EXISTS "Users can update revenues_dre data" ON revenues_dre;
DROP POLICY IF EXISTS "Users can delete revenues_dre data" ON revenues_dre;

-- Criar novas políticas que permitem acesso anônimo
CREATE POLICY "Allow anon to view revenues_dre"
  ON revenues_dre
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon to insert revenues_dre"
  ON revenues_dre
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update revenues_dre"
  ON revenues_dre
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete revenues_dre"
  ON revenues_dre
  FOR DELETE
  TO anon, authenticated
  USING (true);
