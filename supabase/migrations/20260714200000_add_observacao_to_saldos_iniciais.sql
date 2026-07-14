/*
  # Add optional observation/note column to saldos_iniciais

  Used by calendar "Adicionar saldo" and Saldo Inicial card detail modal.
*/

ALTER TABLE saldos_iniciais
  ADD COLUMN IF NOT EXISTS observacao text NULL;

COMMENT ON COLUMN saldos_iniciais.observacao IS 'Observação/nota opcional do lançamento de saldo inicial';
