-- Vehicle inspections table for ITV/revision sheets
CREATE TABLE IF NOT EXISTS vehicle_inspections (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspector_name TEXT,
  items JSONB NOT NULL DEFAULT '{}',
  resultado_general TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by vehicle
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_vehicle ON vehicle_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_company ON vehicle_inspections(company_id);

-- RLS policies
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company inspections"
  ON vehicle_inspections FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = (current_setting('app.current_user_id', true))::bigint
  ));

CREATE POLICY "Users can insert inspections for their company"
  ON vehicle_inspections FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = (current_setting('app.current_user_id', true))::bigint
  ));

CREATE POLICY "Users can delete their company inspections"
  ON vehicle_inspections FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = (current_setting('app.current_user_id', true))::bigint
  ));
