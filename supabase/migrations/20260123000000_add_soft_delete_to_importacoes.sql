/*
  # Add Soft Delete to Importacoes Table

  1. Changes
    - Add `is_deleted` column (boolean, default false)
    - Add `deleted_at` column (timestamptz, nullable)

  2. Purpose
    - Allow soft deletion of imports (move to trash instead of permanent delete)
    - Track when imports were deleted
*/

-- Add is_deleted column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'importacoes' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE importacoes ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add deleted_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'importacoes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE importacoes ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- Create index on is_deleted for faster filtering
CREATE INDEX IF NOT EXISTS idx_importacoes_is_deleted ON importacoes(is_deleted);
