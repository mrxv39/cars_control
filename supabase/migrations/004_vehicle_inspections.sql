CREATE TABLE vehicle_inspections (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    inspector_name TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '{}',
    resultado_general TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicle_inspections_vehicle ON vehicle_inspections(vehicle_id);
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON vehicle_inspections FOR ALL USING (true) WITH CHECK (true);
