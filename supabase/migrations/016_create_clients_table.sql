-- Migration 016: Crear tabla clients (faltaba en producción)
--
-- Contexto: el código de la app (api-records.listClients, LeadsList.convertToClient,
-- RecordLists.ClientsList, GlobalSearchResults...) hace referencias a `public.clients`
-- y la migración 014 (local-only) asume que existe para añadir RLS, pero la tabla
-- nunca se creó. Resultado: cada login disparaba un 404 de
-- /rest/v1/clients y mostraba toast "Error inesperado" a Ricard.
--
-- Detectado durante UX audit Banco Fase 2 (2026-04-19), aplicado a prod 2026-04-20
-- vía MCP apply_migration con name="create_clients_table".
--
-- Schema replica ClientBase + Client (app/src/shared-types.ts, app/src/lib/api-types.ts).
-- RLS replica patrón producción descrito en supabase/CLAUDE.md.

CREATE TABLE IF NOT EXISTS public.clients (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES public.companies(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  dni TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source_lead_id BIGINT REFERENCES public.leads(id) ON DELETE SET NULL,
  vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_company ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_source_lead ON public.clients(source_lead_id) WHERE source_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_vehicle ON public.clients(vehicle_id) WHERE vehicle_id IS NOT NULL;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_company_clients" ON public.clients FOR ALL
  USING ((company_id = get_user_company_id()) OR is_super_admin());
