/*
  # Corrigir políticas RLS para cmv_dre
  
  1. Mudanças
    - Remover políticas antigas que exigem autenticação
    - Adicionar políticas que permitem acesso anônimo (anon)
    - Permitir todas as operações para usuários anônimos
  
  2. Segurança
    - As políticas permitem acesso completo para role anon
    - Adequado para ambiente de desenvolvimento/demo
*/

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view cmv_dre data" ON cmv_dre;
DROP POLICY IF EXISTS "Users can insert cmv_dre data" ON cmv_dre;
DROP POLICY IF EXISTS "Users can update cmv_dre data" ON cmv_dre;
DROP POLICY IF EXISTS "Users can delete cmv_dre data" ON cmv_dre;

-- Criar novas políticas que permitem acesso anônimo
CREATE POLICY "Allow anon to view cmv_dre"
  ON cmv_dre
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon to insert cmv_dre"
  ON cmv_dre
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to update cmv_dre"
  ON cmv_dre
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete cmv_dre"
  ON cmv_dre
  FOR DELETE
  TO anon, authenticated
  USING (true);
