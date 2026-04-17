# Cars Control (CodinaCars)

App de gestión integral para compraventa de vehículos de segunda mano.
Cliente: Ricard (autónomo, CodinaCars).

## Stack

- **Desktop:** Tauri v2 + React + TypeScript + SQLite (rusqlite)
- **Web:** React desplegado en Vercel (app/index-web.html)
- **Backend:** Supabase proyecto `cars-control` (ID: `kpgkcersrfvzncqupkxa`, región eu-west-1). Edge Functions para sync leads desde Gmail/coches.net
- **Auth:** Supabase Auth (signInWithPassword + Google OAuth). Login custom migrado 2026-04-15.
- **Arranque local:** `cd app && npm run tauri dev` (Vite puerto 3000)
- **Tests:** `cd app && npm test`

### Deploy web (Vercel)

Dos proyectos Vercel, mismo build, comportamiento distinto por hostname:

- **Tienda pública:** `https://codinacars.vercel.app` — catálogo (company_id=1, sin login)
- **Panel admin:** `https://carscontrol.vercel.app` — login requerido, gestión completa
- **Team:** `mrxv39s-projects` (team_rWo8ZPj5KmzqksM9hEKV0H6X)
- **Detección de modo:** `WebApp.tsx:getAppMode()` lee hostname:
  `codinacars` → store | `carscontrol` → admin | localhost → both
- **Deploy:** `vercel link --project=<nombre> --scope mrxv39s-projects && vercel deploy --prod --yes`
- **Ricard solo usa la web** (no Tauri). Verificar features en producción.

## Estructura principal

```
app/src/components/   — Vistas React (StockView, LeadsView, SalesRecordsView, ClientsView, etc.)
app/src-tauri/        — Backend Rust (db.rs, main.rs)
docs/                 — Guías HTML para Ricard y documentación de flujos
scripts/              — Scripts Python (OCR, import banco, import stock). Detalle en scripts/CLAUDE.md
supabase/functions/   — Edge functions (sync-leads). Detalle en supabase/CLAUDE.md
```

## Reglas de negocio validadas por Ricard (2026-04-03)

### Vehículos
- Mínimo **40 fotos** por vehículo (cuando está acabado de limpieza)
- Checklist: fotos (40+), ficha técnica, permiso circulación, factura compra, reparaciones
- Estados: DISPONIBLE → LISTO PARA VENTA → RESERVADO → VENDIDO

### Leads
- **Siempre vinculados a un vehículo** — todos llegan desde consultas por un anuncio concreto en coches.net
- Matching: primero por ID numérico del anuncio (→ `vehicle_listings`), fallback fuzzy por nombre
- Fuentes: chat coches.net (sync automático), llamada, WhatsApp, walk-in
- Estados: NUEVO → CONTACTADO → EN NEGOCIACIÓN → COMPRA / NO COMPRA
- Recordatorios automáticos por inactividad, desactivables al pasar a "no compra"

### Facturación
- Tipos: **REBU** (~90%, IVA sobre margen) o IVA normal 21%
- Numeración correlativa F-YYYY-NNN, datos Ricard (autónomo)
- Trimestral: Modelo 303 (IVA), 130 (IRPF 20%), 349 (intracomunitario Auto1)

## 🔴 SEGURIDAD — RGPD / privacidad

### Buckets
- **`vehicle-photos`**: PÚBLICO. Solo fotos del vehículo. NUNCA DNIs ni documentos.
- **`vehicle-docs`**: **PRIVADO** (RLS). Documentos sensibles via signed URLs de 1h.

### Patrones sensibles (NO van a vehicle-photos)
> dni · nie · pasaporte · carnet · certificado · titularidad · iban · cuenta ·
> nomina · nómina · vida laboral · renta · irpf · contrato · compraventa · padron

### Reglas para Claude
1. **NUNCA** subir archivo sensible al bucket `vehicle-photos`
2. **NUNCA** cambiar `vehicle-docs` a público
3. **NUNCA** reemplazar `createSignedUrl()` por `getPublicUrl()` en vehicle-docs
4. Antes de import masivo: verificar nombres con patrones sensibles
5. Archivo sensible mal ubicado: borrar del público, mover al privado, avisar

## 🔴 SEGURIDAD — datos bancarios

1. **NUNCA** endpoint público para `bank_transactions`
2. **NUNCA** logear descripciones completas de movimientos en producción
3. **NUNCA** incluir `bank_transactions` en exports masivos genéricos
4. Cuenta personal (`is_personal=true`): excluida del cómputo fiscal
5. PSD2: consentimiento expira cada 90 días, banner desde 7 días antes

Detalle completo de reglas bancarias, cuentas, y pendientes en `supabase/CLAUDE.md`.

## Performance — reglas para listados

- **NUNCA** N+1: usar `.in()` batch en vez de `Promise.all(ids.map(...))`
- Cards de listado reciben todo por **props** del padre (no fetch propio)
- Thumbnails: URL directa sin transform (Supabase Image Transforms no disponible)
- Fotos coches.net externas: no se pueden transformar (`thumbUrl` es null)

## Convenciones de fotos

- Foto principal = frontal-lateral 3/4. Campo `vehicle_photos.is_primary`.
- Heurística auto: `1.jpg` / `1.jpeg` se marca como principal al importar.

## Archivos grandes (referencia para agentes)

| Archivo | Líneas | Notas |
|---------|--------|-------|
| `app/src/WebApp.tsx` | ~565 | Shell web — login, sidebar, routing |
| `app/src/lib/api.ts` | ~115 | Fachada — re-exports de api-types, api-vehicles, api-bank, api-records |
| `app/src/lib/api-vehicles.ts` | ~286 | Vehículos, fotos, docs, inspecciones, import coches.net |
| `app/src/lib/translateError.ts` | ~11 | Traducción errores Supabase/red a mensajes usuario |
| `app/src/lib/toast.ts` | ~16 | Pub/sub toasts globales — import showToast() desde cualquier componente |
| `app/src/components/web/VehicleDetailPanel.tsx` | ~553 | Ficha vehículo: detalle, fotos, docs, leads, compra |
| `app/src/components/web/StockList.tsx` | ~594 | Listado stock admin con filtros e import coches.net |
| `app/src/components/BankList.tsx` | ~532 | Listado banco con categorización |
| `app/src/components/web/RecordLists.tsx` | ~480 | Clientes, ventas, compras, proveedores (con búsqueda y paginación) |
| `app/src/components/web/PublicCatalog.tsx` | ~340 | Catálogo público, galería, contacto |
| `app/src/components/web/RevisionSheet.tsx` | ~318 | Hoja revisión vehículo + historial |
| `app/src/components/web/ProfileCompanyViews.tsx` | ~228 | Perfil usuario y datos empresa |

## Pendiente

- Template factura REBU/IVA (datos fiscales Ricard en tabla `companies`)
- Viabilidad automatizar provisional circulación → Gestoría Ruppmann
- Descargar fotos coches.net a Storage propio
- Banco: reconciliador MOV_INTERNO, Fase 2/3 (ver `supabase/CLAUDE.md`)
- Sync-leads: migrar a pg_cron, bloqueado por OAuth2 Gmail de Ricard (ver `supabase/CLAUDE.md`)

## Sesiones de validación

- 2026-04-03: validación inicial flujos de trabajo
- 2026-04-08: import zip, RGPD fix, perf, banco Fase 1+2, cuentas Ricard
- 2026-04-15: migración Supabase dedicado + Auth, RLS, dos dominios Vercel
- 2026-04-15c: security fixes, Playwright E2E, filtros catálogo, a11y
- 2026-04-16: mantenimiento — dep-update, WebApp 3873→1292L, 366+160 tests
- 2026-04-17: mantenimiento — api.ts split, WebApp→886L, migration 015, 446+160 tests
- 2026-04-17b: mantenimiento — TS fix, WebApp→564L (extraer RevisionSheet), 495 tests (+49), deps all latest, MAZDA cleanup, main synced
- 2026-04-17c: mantenimiento — fix 3 errores TS, eliminar 6 any, extraer translateError, +54 tests (549 total), 0 errores tsc
- 2026-04-17d: UX audit — 59 hallazgos (Playwright + código), 35 resueltos, toast.ts, forgot password, tildes RevisionSheet, labels español
- 2026-04-17e: UX audit ronda 3 — 45 hallazgos (5 agentes paralelo), 45/45 resueltos, error handling, tildes, SuppliersList búsqueda+paginación, OnboardingTour a11y, 549 tests
- 2026-04-17f: security review — 7 fixes (auth edge functions, CORS restrictivo, CSP Tauri, PII redactada, companyId filter), 549 tests
