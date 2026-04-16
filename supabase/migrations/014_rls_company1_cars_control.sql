-- Migration 014: Harden RLS for cars_control tables
-- Replace permissive anon_all policies with company_id = 1 filtering
-- Enable RLS on tables that had it disabled
-- Pattern matches existing bank_* and lead_messages policies

BEGIN;

-- ============================================================
-- 1. Tables with direct company_id column
-- ============================================================

-- vehicles
DROP POLICY IF EXISTS "anon_all" ON vehicles;
CREATE POLICY "cc_company1" ON vehicles FOR ALL
  USING (company_id = 1) WITH CHECK (company_id = 1);

-- suppliers
DROP POLICY IF EXISTS "anon_all" ON suppliers;
CREATE POLICY "cc_company1" ON suppliers FOR ALL
  USING (company_id = 1) WITH CHECK (company_id = 1);

-- purchase_records
DROP POLICY IF EXISTS "anon_all" ON purchase_records;
CREATE POLICY "cc_company1" ON purchase_records FOR ALL
  USING (company_id = 1) WITH CHECK (company_id = 1);

-- sales_records
DROP POLICY IF EXISTS "anon_all" ON sales_records;
CREATE POLICY "cc_company1" ON sales_records FOR ALL
  USING (company_id = 1) WITH CHECK (company_id = 1);

-- vehicle_inspections
DROP POLICY IF EXISTS "anon_all" ON vehicle_inspections;
CREATE POLICY "cc_company1" ON vehicle_inspections FOR ALL
  USING (company_id = 1) WITH CHECK (company_id = 1);

-- leads
DROP POLICY IF EXISTS "anon_all" ON leads;
CREATE POLICY "cc_company1" ON leads FOR ALL
  USING (company_id = 1) WITH CHECK (company_id = 1);

-- ============================================================
-- 2. Tables without company_id — subquery via vehicle_id
-- ============================================================

-- vehicle_photos (via vehicles.company_id)
DROP POLICY IF EXISTS "anon_all" ON vehicle_photos;
CREATE POLICY "cc_company1" ON vehicle_photos FOR ALL
  USING (vehicle_id IN (SELECT id FROM vehicles WHERE company_id = 1))
  WITH CHECK (vehicle_id IN (SELECT id FROM vehicles WHERE company_id = 1));

-- vehicle_documents (via vehicles.company_id)
DROP POLICY IF EXISTS "anon_all" ON vehicle_documents;
CREATE POLICY "cc_company1" ON vehicle_documents FOR ALL
  USING (vehicle_id IN (SELECT id FROM vehicles WHERE company_id = 1))
  WITH CHECK (vehicle_id IN (SELECT id FROM vehicles WHERE company_id = 1));

-- ============================================================
-- 3. Tables with RLS DISABLED — enable + add policy
-- ============================================================

-- vehicle_listings (via vehicles.company_id)
ALTER TABLE vehicle_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_company1" ON vehicle_listings FOR ALL
  USING (vehicle_id IN (SELECT id FROM vehicles WHERE company_id = 1))
  WITH CHECK (vehicle_id IN (SELECT id FROM vehicles WHERE company_id = 1));

-- vehicle_videos (via vehicles.company_id)
ALTER TABLE vehicle_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_company1" ON vehicle_videos FOR ALL
  USING (vehicle_id IN (SELECT id FROM vehicles WHERE company_id = 1))
  WITH CHECK (vehicle_id IN (SELECT id FROM vehicles WHERE company_id = 1));

-- ============================================================
-- 4. lead_notes — subquery via lead_id → leads.company_id
-- ============================================================

DROP POLICY IF EXISTS "anon_all" ON lead_notes;
CREATE POLICY "cc_company1" ON lead_notes FOR ALL
  USING (lead_id IN (SELECT id FROM leads WHERE company_id = 1))
  WITH CHECK (lead_id IN (SELECT id FROM leads WHERE company_id = 1));

-- ============================================================
-- 5. Tables missing from initial hardening
-- ============================================================

-- clients (has company_id column, contains personal data: name, phone, DNI)
DROP POLICY IF EXISTS "anon_all" ON clients;
CREATE POLICY "cc_company1" ON clients FOR ALL
  USING (company_id = 1) WITH CHECK (company_id = 1);

-- companies (restrict to own company only)
DROP POLICY IF EXISTS "anon_all" ON companies;
CREATE POLICY "cc_company1" ON companies FOR ALL
  USING (id = 1) WITH CHECK (id = 1);

-- users (contains password hashes — split policies to protect sensitive columns)
DROP POLICY IF EXISTS "anon_all" ON users;
-- SELECT: only authenticated users, exclude password_hash via view or explicit columns
-- Note: RLS cannot filter columns, so we restrict to authenticated only
CREATE POLICY "cc_company1_read" ON users FOR SELECT
  USING (company_id = 1 AND auth.role() = 'authenticated');
CREATE POLICY "cc_company1_write" ON users FOR INSERT
  WITH CHECK (company_id = 1 AND auth.role() = 'authenticated');
CREATE POLICY "cc_company1_update" ON users FOR UPDATE
  USING (company_id = 1 AND auth.role() = 'authenticated')
  WITH CHECK (company_id = 1 AND auth.role() = 'authenticated');
CREATE POLICY "cc_company1_delete" ON users FOR DELETE
  USING (company_id = 1 AND auth.role() = 'authenticated');

-- feedback (no company_id — restrict writes to authenticated, allow anon INSERT only)
DROP POLICY IF EXISTS "anon_all" ON feedback;
CREATE POLICY "cc_feedback_read" ON feedback FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "cc_feedback_insert" ON feedback FOR INSERT
  WITH CHECK (true);
CREATE POLICY "cc_feedback_update" ON feedback FOR UPDATE
  USING (auth.role() = 'authenticated');
CREATE POLICY "cc_feedback_delete" ON feedback FOR DELETE
  USING (auth.role() = 'authenticated');
-- DONE: feedback.company_id added in migration 015_feedback_company_id.sql

-- ============================================================
-- 6. Storage: vehicle-docs bucket MUST be private (RGPD)
--    Contains DNIs, contracts, invoices — never publicly accessible
-- ============================================================

UPDATE storage.buckets SET public = false WHERE id = 'vehicle-docs';

-- Drop overly permissive storage policies from migration 001
DROP POLICY IF EXISTS "Public read vehicle docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload vehicle docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete vehicle docs" ON storage.objects;

-- Restrictive policies: only authenticated users can access vehicle-docs
CREATE POLICY "Authenticated read vehicle docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'vehicle-docs' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated upload vehicle docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'vehicle-docs' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated delete vehicle docs" ON storage.objects
  FOR DELETE USING (bucket_id = 'vehicle-docs' AND auth.role() = 'authenticated');

COMMIT;
