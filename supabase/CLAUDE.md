# Supabase — Detalle de implementación

## Reglas de negocio bancarias (validado Ricard 2026-04-08)

Ricard opera **EXCLUSIVAMENTE con CaixaBank** y tiene **3 cuentas**:

| `bank_accounts.id` | alias | IBAN | tipo | personal | uso |
|---|---|---|---|---|---|
| 1 | RICARD CODINA LUDEÑA | ****2130 | checking | **true** | particular, excluida del cómputo fiscal |
| 2 | CODINACARS | ****5385 | checking | false | operativa: compras Auto1, ventas, Hacienda, TGSS |
| 3 | POLIZA CODINACARS | ****7550 | credit_line | false | línea de crédito, disposiciones/reintegros |

### Decisiones de Ricard pendientes de implementar
- Cuenta personal: importar SÍ pero filtrar del cómputo fiscal (`is_personal=true`)
- Histórico: 2025+2026 completos → N43 manual obligatorio (PSD2 solo da 90 días)
- PSD2 90d: acepta renovar. Email GoCardless: `codinacars@gmail.com`
- Bizum: pagas y señales → dejar como SIN_CATEGORIZAR para reconciliar manualmente
- Financiaciones de venta: dinero entra 1-3 días después de firma → ventana match ±21 días (pendiente)
- Riesgo Fase 3: GoCardless puede no soportar cuenta póliza de crédito

### Categorización automática
Reglas en `bank_category_rules` (16 seed migration 012, fix migration 013), aplicadas por prioridad.
Cuando Ricard recategoriza a mano, se ofrecerá "crear regla" en Fase 2.

## Banco — pendientes

### ~~1. Ampliar ventana de match ±15 → ±21 días~~ (completado — ya usa 21 * 86400000)

### 2. Reconciliación "puente 2024-2025"
Oct 2024 – Ene 2025: Ricard usó cuenta personal 2130 como puente para TRF.INTERNACIONAL a Auto 1
(7 compras, 47.246,60 €). Patrón: traspàs empresa→personal + TRF a Auto 1 el mismo día.
Desde feb-2025 cero, desde ago-2025 usa línea de crédito 7550 (solución madura).
**NO es fraude** — autónomo novato, gestor declaró bien modelo 349.

Herramienta pendiente: reconciliador automático que busca pares (traspaso, TRF Auto1) con
fechas ±7 días e importes que cuadran, los marca como MOV_INTERNO, alerta si hay huérfanos.

### ~~3. Banco Fase 2~~ (completado 2026-04-19)
Editor categoría inline (commit 68f0b72) + `CreatePurchaseModal` y
`CreateRuleModal`: crear compra desde movimiento con un click, y
auto-sugerir regla al recategorizar un SIN_CATEGORIZAR manualmente.

### 4. Banco Fase 3
Edge function `sync-bank-caixa` con GoCardless. Registro en bankaccountdata.gocardless.com.

## Edge function suggest-reply (autoresponder leads)

Genera un borrador de respuesta para un lead de coches.net usando Claude API (Haiku 4.5).
Ricard edita y copia a coches.net manualmente — NO se envía nada.

**Archivos:** `supabase/functions/suggest-reply/` → `index.ts` (entry), `handler.ts` (lógica testable),
`few_shots.ts` (6 pares reales de Ricard, extraídos de `_leads_analysis_2026-04-21/pairs_v2.json`),
`lang_detect.ts` (regex castellano/catalán), `sanitize.ts` (redacta tel/email excepto 646131565).

**Invocación desde frontend:** `api.suggestLeadReply(leadId)` → `app/src/lib/api-records.ts`.
Llama con body `{leadId}` y header `x-app-secret` (leído de `import.meta.env.VITE_SUGGEST_REPLY_SECRET`).

**Secretos en Supabase** (`supabase secrets set`):
- `ANTHROPIC_API_KEY` — clave Claude API de Ricard
- `SUGGEST_REPLY_SECRET` — random hex (generado con `openssl rand -hex 16`), también en `.env.local` del frontend como `VITE_SUGGEST_REPLY_SECRET`

**Deploy:** `supabase functions deploy suggest-reply --no-verify-jwt` (JWT ES256 custom, ver memoria).

**Output:** `{ok, reply, language, took_ms}` en éxito. En error: `{ok:false, reply:fallback, error, language}`
— el frontend muestra el fallback siempre para que Ricard no se quede sin nada.

**Datos enviados al LLM:** solo first_name del lead + `name/anio/km/precio/estado/fuel/transmission` del vehículo +
conversación sanitizada (tel/email redactados). NO se envían apellidos, email ni teléfono del lead.

**Tests:** `deno test supabase/functions/suggest-reply/` (requiere Deno instalado) y `npm test LeadsList` (vitest).

## Migración cron sync-leads

Estado 2026-04-09:
- Código local: `supabase/functions/sync-leads/index.ts` (558 líneas) ✅
- Edge function en Supabase: ❌ NO desplegada
- `pg_cron` + `pg_net`: ✅ habilitados, 3 jobs activos como referencia
- Tarea local ahora silenciosa vía `sync_leads_silent.vbs`

**Bloqueado por**: Ricard debe completar guía OAuth2 Gmail (`docs/guia_oauth2_gmail.html`)
para obtener CLIENT_ID/SECRET/REFRESH_TOKEN.

Pasos pendientes cuando Ricard envíe los valores:
1. Configurar 3 secretos en Supabase
2. Deploy edge function con `verify_jwt=false`
3. Crear cron job `*/5 * * * *`
4. Invocación manual de prueba
5. Deshabilitar Task Scheduler local

## Auth y RLS

### Funciones RPC creadas (2026-04-15)
- **`resolve_login(p_username)`**: SECURITY DEFINER, resuelve username → email para login
- **`link_oauth_user(p_email, p_provider, p_provider_id, p_full_name)`**: SECURITY DEFINER,
  vincula Google OAuth con usuario de la app, devuelve user+company
- **`get_user_company_id()`**: lee `auth.uid()` → `users.auth_provider_id` → `company_id`
- **`is_super_admin()`**: verifica `users.role = 'super_admin'` para el auth.uid() actual

### Políticas RLS en producción
Todas las tablas usan `get_user_company_id() OR is_super_admin()` (NO la migration 014 local).
Excepciones:
- `vehicles`: tiene policy adicional `public_read_vehicles` (SELECT, company_id=1) para tienda
- `vehicle_photos`: tiene `public_read_vehicle_photos` (SELECT) para tienda
- `vehicle_listings`, `vehicle_videos`: tienen `public_view_*` (SELECT true)
