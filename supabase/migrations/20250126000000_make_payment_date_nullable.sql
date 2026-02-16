/*
  # Make payment_date nullable in contas_a_pagar
  
  Allow payment_date to be NULL when status is "previsto" (pending)
  This makes sense because pending payments don't have a payment date yet.
*/

-- Alter payment_date column to allow NULL
ALTER TABLE "CONTAS A PAGAR" 
  ALTER COLUMN payment_date DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN "CONTAS A PAGAR".payment_date IS 
  'Data de pagamento. Pode ser NULL quando status for "previsto" (pendente).';
