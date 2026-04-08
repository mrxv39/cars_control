-- ============================================================
-- Migration 012: Bank integration (CaixaBank)
-- ============================================================
-- Validado con Ricard 2026-04-08:
--
-- Ricard opera EXCLUSIVAMENTE con CaixaBank y tiene 3 cuentas:
--   1. Personal     - uso particular (NO mezclar con autónomo por riesgo fiscal)
--   2. Autónomo     - cuenta operativa CodinaCars (compras/ventas/Hacienda)
--   3. Póliza       - línea de crédito del negocio (no es cuenta corriente)
--
-- Estrategia:
--   Fase 1 (esta migración): tablas + import N43 manual (parser Python)
--   Fase 2: categorización + reconciliación contra purchase/sales_records
--   Fase 3: GoCardless API (PSD2 agregador, gratis, consent 90 días)
--
-- Histórico necesario: 1-2 años → import N43 inicial obligatorio
-- (PSD2 solo da ~90 días hacia atrás).
--
-- 🔴 SEGURIDAD: bank_transactions contienen datos personales sensibles.
-- Mismo nivel que vehicle-docs (DNIs, contratos). Ver CLAUDE.md sección
-- "SEGURIDAD - datos bancarios". NUNCA exportar masivamente, NUNCA logear
-- descripciones completas en producción, NUNCA crear endpoint público.
-- ============================================================

-- ----------------------------------------
-- bank_accounts
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS bank_accounts (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  alias TEXT NOT NULL,                      -- "Personal", "Autónomo", "Póliza CodinaCars"
  iban TEXT,                                -- nullable: imports N43 pueden no traerlo
  bank_name TEXT NOT NULL DEFAULT 'CaixaBank',
  account_type TEXT NOT NULL CHECK (account_type IN ('checking', 'credit_line')),
  is_personal BOOLEAN NOT NULL DEFAULT false,   -- excluir del cómputo fiscal por defecto
  provider TEXT NOT NULL CHECK (provider IN ('gocardless', 'n43_manual')),
  external_id TEXT,                         -- id de GoCardless cuando aplique
  consent_expires_at TIMESTAMPTZ,           -- aviso renovación PSD2 (Fase 3)
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_company ON bank_accounts(company_id);

-- ----------------------------------------
-- bank_transactions
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS bank_transactions (
  id BIGSERIAL PRIMARY KEY,
  bank_account_id BIGINT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,                -- id banco (GoCardless) o sha1 N43 → idempotencia
  booking_date DATE NOT NULL,
  value_date DATE,
  amount NUMERIC(12, 2) NOT NULL,           -- positivo ingreso, negativo gasto
  currency TEXT NOT NULL DEFAULT 'EUR',
  counterparty_name TEXT DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  balance_after NUMERIC(12, 2),
  raw_payload JSONB,                        -- guardar fila cruda para debugging/recategorización
  category TEXT NOT NULL DEFAULT 'SIN_CATEGORIZAR',
  linked_sale_id BIGINT REFERENCES sales_records(id) ON DELETE SET NULL,
  linked_purchase_id BIGINT REFERENCES purchase_records(id) ON DELETE SET NULL,
  reviewed_by_user BOOLEAN NOT NULL DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bank_account_id, external_id)     -- idempotencia: re-import seguro
);

CREATE INDEX idx_bank_tx_account_date ON bank_transactions(bank_account_id, booking_date DESC);
CREATE INDEX idx_bank_tx_uncategorized ON bank_transactions(category) WHERE category = 'SIN_CATEGORIZAR';
CREATE INDEX idx_bank_tx_unlinked ON bank_transactions(bank_account_id)
  WHERE linked_sale_id IS NULL AND linked_purchase_id IS NULL;
CREATE INDEX idx_bank_tx_linked_purchase ON bank_transactions(linked_purchase_id) WHERE linked_purchase_id IS NOT NULL;
CREATE INDEX idx_bank_tx_linked_sale ON bank_transactions(linked_sale_id) WHERE linked_sale_id IS NOT NULL;

-- ----------------------------------------
-- bank_category_rules
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS bank_category_rules (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  pattern TEXT NOT NULL,                    -- regex case-insensitive sobre description+counterparty
  category TEXT NOT NULL,
  default_expense_type TEXT,                -- para auto-crear purchase_record (alineado con PurchasesView enum)
  priority INT NOT NULL DEFAULT 100,        -- menor número = mayor prioridad
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_rules_company ON bank_category_rules(company_id, priority) WHERE active = true;

-- ----------------------------------------
-- RLS (mismo patrón que migration 011: company_id = 1)
-- ----------------------------------------
-- Nota: el proyecto entero usa policies permisivas a nivel cliente (la app
-- filtra por company_id). Ver supabase_schema.sql:194-205. Cuando se haga el
-- endurecimiento global de RLS, estas tablas se beneficiarán automáticamente
-- y deberán ser de las primeras (datos sensibles).

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts_company1" ON bank_accounts FOR ALL USING (company_id = 1) WITH CHECK (company_id = 1);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
-- bank_transactions no tiene company_id directo: se hereda vía bank_account_id.
-- Política estricta: solo movimientos cuya cuenta pertenece a company 1.
CREATE POLICY "bank_tx_company1" ON bank_transactions FOR ALL
  USING (bank_account_id IN (SELECT id FROM bank_accounts WHERE company_id = 1))
  WITH CHECK (bank_account_id IN (SELECT id FROM bank_accounts WHERE company_id = 1));

ALTER TABLE bank_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_rules_company1" ON bank_category_rules FOR ALL USING (company_id = 1) WITH CHECK (company_id = 1);

-- ----------------------------------------
-- updated_at trigger para bank_transactions
-- ----------------------------------------
CREATE OR REPLACE FUNCTION bank_tx_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bank_tx_updated_at
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION bank_tx_set_updated_at();
