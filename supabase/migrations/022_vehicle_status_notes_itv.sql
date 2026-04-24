-- Extiende el estado de preparación del vehículo:
--   · ok_at (timestamptz): fecha en que se marcó OK cada sección.
--   · notes (text): diagnóstico libre de Ricard.
--   · ITV: sección nueva (ok + ok_at + supplier + notes).
-- Orden visual en UI: motor → carroceria → neumaticos → itv → limpieza.
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS motor_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS motor_notes text,

  ADD COLUMN IF NOT EXISTS carroceria_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS carroceria_notes text,

  ADD COLUMN IF NOT EXISTS neumaticos_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS neumaticos_notes text,

  ADD COLUMN IF NOT EXISTS itv_ok boolean,
  ADD COLUMN IF NOT EXISTS itv_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS itv_supplier_id integer REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS itv_notes text,

  ADD COLUMN IF NOT EXISTS limpieza_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS limpieza_notes text;
