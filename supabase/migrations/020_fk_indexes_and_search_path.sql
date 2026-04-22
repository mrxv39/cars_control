-- Migration 020: indices de FK + search_path fix
--
-- Corrige dos avisos del linter de Supabase:
-- 1. 33 foreign keys sin indice de cobertura (perf-001)
-- 2. Funciones get_user_company_id / is_super_admin con search_path mutable (sec-001)
--
-- Todos los CREATE INDEX usan IF NOT EXISTS para ser idempotentes.

-- ---------------------------------------------------------------------------
-- Parte 1: indices para foreign keys
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company_id ON public.bank_accounts (company_id);
CREATE INDEX IF NOT EXISTS idx_bank_category_rules_company_id ON public.bank_category_rules (company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank_account_id ON public.bank_transactions (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_linked_purchase_id ON public.bank_transactions (linked_purchase_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_linked_sale_id ON public.bank_transactions (linked_sale_id);
CREATE INDEX IF NOT EXISTS idx_company_registrations_created_company_id ON public.company_registrations (created_company_id);
CREATE INDEX IF NOT EXISTS idx_company_registrations_reviewed_by ON public.company_registrations (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON public.company_settings (company_id);
CREATE INDEX IF NOT EXISTS idx_feedback_company_id ON public.feedback (company_id);
CREATE INDEX IF NOT EXISTS idx_lead_messages_company_id ON public.lead_messages (company_id);
CREATE INDEX IF NOT EXISTS idx_lead_messages_lead_id ON public.lead_messages (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON public.lead_notes (lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads (company_id);
CREATE INDEX IF NOT EXISTS idx_leads_vehicle_id ON public.leads (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_purchase_records_company_id ON public.purchase_records (company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_records_supplier_id ON public.purchase_records (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_records_vehicle_id ON public.purchase_records (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_company_id ON public.sales_records (company_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_lead_id ON public.sales_records (lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_vehicle_id ON public.sales_records (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers (company_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_accepted_user_id ON public.user_invitations (accepted_user_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_company_id ON public.user_invitations (company_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_invited_by ON public.user_invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users (company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle_id ON public.vehicle_documents (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_company_id ON public.vehicle_inspections (company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_vehicle_id ON public.vehicle_inspections (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_vehicle_id ON public.vehicle_listings (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vehicle_id ON public.vehicle_photos (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_videos_vehicle_id ON public.vehicle_videos (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON public.vehicles (company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_supplier_id ON public.vehicles (supplier_id);

-- ---------------------------------------------------------------------------
-- Parte 2: fijar search_path en funciones SECURITY DEFINER
-- ---------------------------------------------------------------------------
-- El linter marca estas dos con search_path mutable. Fijarlo a `public`
-- evita ataques de hijacking via schemas con prioridad alta en el path.

ALTER FUNCTION public.get_user_company_id() SET search_path = public;
ALTER FUNCTION public.is_super_admin() SET search_path = public;
