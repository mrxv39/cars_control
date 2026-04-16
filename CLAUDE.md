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
- Thumbnails: `getPublicUrl(path, { transform: { width: 400, quality: 70 } })`
- Fotos coches.net externas: no se pueden transformar (`thumbUrl` es null)

## Convenciones de fotos

- Foto principal = frontal-lateral 3/4. Campo `vehicle_photos.is_primary`.
- Heurística auto: `1.jpg` / `1.jpeg` se marca como principal al importar.

## Pendiente

- Re-subir fotos a Storage nuevo (buckets no existen tras migración Supabase)
- Template factura REBU/IVA (datos fiscales Ricard en tabla `companies`)
- ~~Tablas responsive en móvil~~ (implementado: card layout <768px, commit e64b2f4)
- Viabilidad automatizar provisional circulación → Gestoría Ruppmann
- Descargar fotos coches.net a Storage propio
- Lazy-load IntersectionObserver en listado Stock
- Banco: ventana match ±21 días, reconciliador MOV_INTERNO, Fase 2/3 (ver `supabase/CLAUDE.md`)
- Sync-leads: migrar a pg_cron, bloqueado por OAuth2 Gmail de Ricard (ver `supabase/CLAUDE.md`)
- ~~BankList.tsx (777 líneas)~~: refactorizado a 531 líneas (commit 45e7da1, extraído LinkPurchaseModal y bank-utils)
- Tests Python: añadir pytest suite para scripts/ (import, OCR, extractores)

## Sesiones de validación

- 2026-04-03: validación inicial flujos de trabajo
- 2026-04-04: bot leads, rediseño stock, autocompletado reparaciones
- 2026-04-08: import zip, RGPD fix, perf 12.6→4.7s, banco Fase 1+2, cuentas Ricard
- 2026-04-09: sync-leads silencioso, guía OAuth2 Gmail
- 2026-04-11: import 2651 movimientos CaixaBank via PDF, migration 013 fix regex
- 2026-04-15: migración Supabase dedicado, RLS auth.uid(), dos dominios Vercel
- 2026-04-15b: migración Supabase Auth (login+Google OAuth), fotos Storage pendientes
- 2026-04-15c: security fixes, Playwright E2E, filtros catálogo, iconos sidebar, skeleton, a11y modales
- 2026-04-16: mantenimiento — git cleanup, dep-update (0 vulns), useEscapeKey hook, audit CLAUDE.md
