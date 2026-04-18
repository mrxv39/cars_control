# Sesiones de validación y mantenimiento — Cars Control

Log resumido de sesiones de trabajo con Ricard y mantenimiento técnico.
Para detalle completo: `git log` y los archivos de sesión en memory.

## 2026-04

- **04-03:** validación inicial flujos de trabajo
- **04-08:** import zip, RGPD fix, perf, banco Fase 1+2, cuentas Ricard
- **04-15:** migración Supabase dedicado + Auth, RLS, dos dominios Vercel
- **04-15c:** security fixes, Playwright E2E, filtros catálogo, a11y
- **04-16:** mantenimiento — dep-update, WebApp 3873→1292L, 366+160 tests
- **04-17:** mantenimiento — api.ts split, WebApp→886L, migration 015, 446+160 tests
- **04-17b:** mantenimiento — TS fix, WebApp→564L (extraer RevisionSheet), 495 tests (+49), deps all latest, MAZDA cleanup, main synced
- **04-17c:** mantenimiento — fix 3 errores TS, eliminar 6 any, extraer translateError, +54 tests (549 total), 0 errores tsc
- **04-17d:** UX audit — 59 hallazgos (Playwright + código), 35 resueltos, toast.ts, forgot password, tildes RevisionSheet, labels español
- **04-17e:** UX audit ronda 3 — 45 hallazgos (5 agentes paralelo), 45/45 resueltos, error handling, tildes, SuppliersList búsqueda+paginación, OnboardingTour a11y, 549 tests
- **04-17f:** security review — 7 fixes (auth edge functions, CORS restrictivo, CSP Tauri, PII redactada, companyId filter), 549 tests
- **04-18a:** ui-polish ronda 1 — StockList/VehicleDetail/BankList/RecordLists, 2 commits (bd35c05 + 5382335), a11y (role=link, aria-labels contextuales), tokens CSS (~40 colores + ~30 fontSizes), 549 tests
- **04-19a:** simplify rondas 1-4 — 10 archivos refactorizados (App.tsx, LeadsList, SalesRecordsView, WebApp, import_caixa_pdf.py, PublicCatalog, import_n43.py, StockDetailView, WebDashboard, extract_ricard_corpus.py), 10 commits pusheados a master, webapp-testing smoke OK rutas públicas, 549 TS + 81 Python tests verdes
- **04-19b:** project-maintenance — 13/14 ítems aprobados. Extraído LoginForm (199L), GlobalSearchResults (70L) + memoización, GoogleIcon (10L) de WebApp (617→375L). VehicleDetailPanel (584→420L) dividido en vehicle-detail/ (VDFactura, VDLeads, VDVehicleDocs, VDPurchaseInfo). +10 tests GlobalSearchResults (558→568). Movidos 8 .md obsoletos a docs_legacy/, eliminados 3 forms mantenimiento antiguos.
