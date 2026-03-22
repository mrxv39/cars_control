-- ============================================================
-- Migration 001: Suppliers + Vehicle Documents
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    cif TEXT DEFAULT '',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    contact_person TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON suppliers FOR ALL USING (true) WITH CHECK (true);

-- 2. Add supplier_id to purchase_records
ALTER TABLE purchase_records ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES suppliers(id);

-- 3. VEHICLE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS vehicle_documents (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL DEFAULT 'otro',  -- factura, ficha_tecnica, permiso, contrato, otro
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_docs_vehicle ON vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_docs_type ON vehicle_documents(doc_type);
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON vehicle_documents FOR ALL USING (true) WITH CHECK (true);

-- 4. STORAGE BUCKET for vehicle documents (PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-docs', 'vehicle-docs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read vehicle docs" ON storage.objects
    FOR SELECT USING (bucket_id = 'vehicle-docs');
CREATE POLICY "Allow upload vehicle docs" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'vehicle-docs');
CREATE POLICY "Allow delete vehicle docs" ON storage.objects
    FOR DELETE USING (bucket_id = 'vehicle-docs');
