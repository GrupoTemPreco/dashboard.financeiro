/*
  # Criar tabela receitas_manuais (nova fonte de dados de receita)

  1. Nova Tabela
    - `receitas_manuais`
      - `id` (bigint, primary key, identity) - alinhado às demais tabelas do projeto (bigint)
      - `status` (text) - previsto / realizado (ou pendente / recebida)
      - `unidade` (text) - unidade de negócio
      - `conta` (text) - plano de contas
      - `descricao` (text) - fornecedor ou descrição do lançamento
      - `data` (date) - data do lançamento
      - `valor` (numeric) - valor da receita
      - `import_id` (tipo dinâmico: bigint ou uuid) - igual ao id da tabela importacoes/imports do ambiente
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Segurança
    - RLS habilitado com políticas para anon/authenticated (mesmo padrão de receita_crediario)

  3. Índices
    - import_id, data e unidade para filtros e ordenação

  4. FK import_id
    - Tipo (bigint ou uuid) detectado conforme a tabela de importações do ambiente (importacoes ou imports)
*/

CREATE TABLE IF NOT EXISTS receitas_manuais (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status text NOT NULL DEFAULT 'previsto',
  unidade text NOT NULL,
  conta text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  data date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Adicionar import_id com o mesmo tipo da tabela de importações (bigint ou uuid)
DO $$
DECLARE
  import_id_type text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'importacoes') THEN
    SELECT data_type INTO import_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'importacoes' AND column_name = 'id';

    IF import_id_type = 'bigint' THEN
      ALTER TABLE receitas_manuais ADD COLUMN import_id bigint REFERENCES importacoes(id) ON DELETE CASCADE;
    ELSIF import_id_type = 'uuid' THEN
      ALTER TABLE receitas_manuais ADD COLUMN import_id uuid REFERENCES importacoes(id) ON DELETE CASCADE;
    END IF;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'imports') THEN
    SELECT data_type INTO import_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'imports' AND column_name = 'id';

    IF import_id_type = 'bigint' THEN
      ALTER TABLE receitas_manuais ADD COLUMN import_id bigint REFERENCES imports(id) ON DELETE CASCADE;
    ELSIF import_id_type = 'uuid' THEN
      ALTER TABLE receitas_manuais ADD COLUMN import_id uuid REFERENCES imports(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

ALTER TABLE receitas_manuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to receitas_manuais"
  ON receitas_manuais
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_receitas_manuais_data ON receitas_manuais(data);
CREATE INDEX IF NOT EXISTS idx_receitas_manuais_unidade ON receitas_manuais(unidade);

-- Índices em import_id só existem se a coluna foi criada (quando há tabela importacoes/imports)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'receitas_manuais' AND column_name = 'import_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_receitas_manuais_import_id ON receitas_manuais(import_id);
    CREATE INDEX IF NOT EXISTS idx_receitas_manuais_import_unidade_data
      ON receitas_manuais(import_id, unidade, data);
  END IF;
END $$;
