ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS motor_ok boolean,
  ADD COLUMN IF NOT EXISTS motor_supplier_id integer REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS carroceria_ok boolean,
  ADD COLUMN IF NOT EXISTS carroceria_supplier_id integer REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS neumaticos_ok boolean,
  ADD COLUMN IF NOT EXISTS neumaticos_supplier_id integer REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS limpieza_ok boolean,
  ADD COLUMN IF NOT EXISTS limpieza_supplier_id integer REFERENCES suppliers(id);
