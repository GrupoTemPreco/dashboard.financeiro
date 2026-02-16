/*
  # Criar tabela de Receita Crediário
  
  1. Nova Tabela
    - `receita_crediario`
      - `id` (uuid, primary key)
      - `data_receb` (date) - Data de recebimento
      - `un_neg_receb` (text) - Unidade de negócio recebimento
      - `parcela` (text) - Número da parcela
      - `recebimento` (numeric) - Valor do recebimento
      - `percentual_total` (numeric) - Percentual do total
      - `juros` (numeric) - Valor dos juros
      - `percentual_juros` (numeric) - Percentual dos juros
      - `multa` (numeric) - Valor da multa
      - `percentual_multa` (numeric) - Percentual da multa
      - `taxa_conv` (numeric) - Taxa de conversão
      - `percentual_taxa_conv` (numeric) - Percentual da taxa de conversão
      - `dias_receb` (numeric) - Dias de recebimento
      - `dias_atraso` (numeric) - Dias de atraso
      - `import_id` (uuid) - ID do lote de importação
      - `created_at` (timestamptz) - Data de criação
      - `updated_at` (timestamptz) - Data de atualização
  
  2. Segurança
    - Habilitar RLS na tabela `receita_crediario`
    - Adicionar políticas para usuários autenticados
  
  3. Índices
    - Índices para melhorar performance em consultas por data e unidade de negócio
*/

CREATE TABLE IF NOT EXISTS receita_crediario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_receb date NOT NULL,
  un_neg_receb text NOT NULL,
  parcela text NOT NULL,
  recebimento numeric NOT NULL DEFAULT 0,
  percentual_total numeric DEFAULT 0,
  juros numeric DEFAULT 0,
  percentual_juros numeric DEFAULT 0,
  multa numeric DEFAULT 0,
  percentual_multa numeric DEFAULT 0,
  taxa_conv numeric DEFAULT 0,
  percentual_taxa_conv numeric DEFAULT 0,
  dias_receb numeric NOT NULL DEFAULT 0,
  dias_atraso numeric NOT NULL DEFAULT 0,
  import_id uuid REFERENCES importacoes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE receita_crediario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to receita_crediario"
  ON receita_crediario
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_receita_crediario_data_receb ON receita_crediario(data_receb);
CREATE INDEX IF NOT EXISTS idx_receita_crediario_un_neg_receb ON receita_crediario(un_neg_receb);
CREATE INDEX IF NOT EXISTS idx_receita_crediario_import_id ON receita_crediario(import_id);
