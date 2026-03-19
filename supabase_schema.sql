-- =============================================
-- Cars Control - Supabase Schema (Multi-tenant)
-- =============================================

-- Companies
CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    trade_name TEXT NOT NULL,
    legal_name TEXT DEFAULT '',
    cif TEXT DEFAULT '',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicles
CREATE TABLE vehicles (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    precio_compra DOUBLE PRECISION,
    precio_venta DOUBLE PRECISION,
    km INTEGER,
    anio INTEGER,
    estado TEXT DEFAULT 'disponible',
    ad_url TEXT DEFAULT '',
    ad_status TEXT DEFAULT '',
    fuel TEXT DEFAULT '',
    cv TEXT DEFAULT '',
    transmission TEXT DEFAULT '',
    color TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vehicles_company ON vehicles(company_id);
CREATE INDEX idx_vehicles_estado ON vehicles(estado);

-- Leads
CREATE TABLE leads (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    vehicle_interest TEXT DEFAULT '',
    vehicle_id BIGINT REFERENCES vehicles(id),
    converted_client_id BIGINT,
    estado TEXT DEFAULT 'nuevo',
    fecha_contacto TEXT DEFAULT '',
    canal TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_company ON leads(company_id);
CREATE INDEX idx_leads_estado ON leads(estado);

-- Clients
CREATE TABLE clients (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    dni TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    vehicle_id BIGINT REFERENCES vehicles(id),
    source_lead_id BIGINT REFERENCES leads(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_company ON clients(company_id);

-- Lead Notes
CREATE TABLE lead_notes (
    id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    content TEXT NOT NULL
);

CREATE INDEX idx_lead_notes_lead ON lead_notes(lead_id);

-- Sales Records
CREATE TABLE sales_records (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    vehicle_id BIGINT REFERENCES vehicles(id),
    client_id BIGINT REFERENCES clients(id),
    lead_id BIGINT REFERENCES leads(id),
    price_final DOUBLE PRECISION NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_company ON sales_records(company_id);
CREATE INDEX idx_sales_date ON sales_records(date);

-- Purchase Records (expenses)
CREATE TABLE purchase_records (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id),
    expense_type TEXT NOT NULL DEFAULT 'COMPRA_VEHICULO',
    vehicle_id BIGINT REFERENCES vehicles(id),
    vehicle_name TEXT DEFAULT '',
    plate TEXT DEFAULT '',
    supplier_name TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    purchase_price DOUBLE PRECISION NOT NULL,
    invoice_number TEXT NOT NULL,
    payment_method TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    source_file TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_company ON purchase_records(company_id);
CREATE INDEX idx_purchase_date ON purchase_records(purchase_date);

-- Vehicle Photos
CREATE TABLE vehicle_photos (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_photos_vehicle ON vehicle_photos(vehicle_id);

-- =============================================
-- Seed data: CodinaCars + Ricard user
-- =============================================
INSERT INTO companies (trade_name, legal_name, cif, address, phone, email)
VALUES ('CodinaCars', 'Codina Ludeña, Ricard', '47788643W', 'C/ Sant Antoni Maria Claret 3, Bajos 2, 08750 Molins de Rei', '646 13 15 65', 'codinacars@gmail.com');

-- Password: admin (SHA256 with salt)
INSERT INTO users (company_id, full_name, username, password_hash, role)
VALUES (1, 'Ricard Codina Ludeña', 'ricard', 'e6b97984999c20ce14147731c7dc78366e8b6c85976dcf6a5e63091bea66cb59', 'admin');

-- =============================================
-- Storage bucket for vehicle photos
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-photos', 'vehicle-photos', true);

-- Allow public read access to vehicle photos
CREATE POLICY "Public read vehicle photos" ON storage.objects
    FOR SELECT USING (bucket_id = 'vehicle-photos');

-- Allow authenticated insert/delete
CREATE POLICY "Allow upload vehicle photos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'vehicle-photos');

CREATE POLICY "Allow delete vehicle photos" ON storage.objects
    FOR DELETE USING (bucket_id = 'vehicle-photos');

-- =============================================
-- Enable Row Level Security (disabled for now, using app-level filtering)
-- =============================================
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies: allow all operations via anon key (app handles auth)
CREATE POLICY "anon_all" ON companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON sales_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON purchase_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON lead_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON vehicle_photos FOR ALL USING (true) WITH CHECK (true);
