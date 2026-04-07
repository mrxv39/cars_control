# Cars Control (CodinaCars)

App de gestión integral para compraventa de vehículos de segunda mano.
Cliente: Ricard (autónomo, CodinaCars).

## Stack

- **Desktop:** Tauri v2 + React + TypeScript + SQLite (rusqlite)
- **Web:** React desplegado en Vercel (app/index-web.html)
- **Backend:** Supabase (Edge Functions para sync leads desde Gmail/coches.net)
- **Arranque local:** `cd app && npm run tauri dev` (Vite puerto 3000)
- **Tests:** `cd app && npm test`

## Estructura principal

```
app/src/components/   — Vistas React (StockView, LeadsView, SalesRecordsView, ClientsView, etc.)
app/src-tauri/        — Backend Rust (db.rs, main.rs)
docs/                 — Guías HTML para Ricard y documentación de flujos
supabase/functions/   — Edge functions (sync-leads)
```

## Reglas de negocio validadas por Ricard (2026-04-03)

### Vehículos
- Mínimo **40 fotos** por vehículo (cuando está acabado de limpieza)
- Checklist de preparación: fotos (40+), ficha técnica, permiso circulación, factura compra, reparaciones
- Barra progreso: 5/5 = LISTO PARA VENTA
- Estados: DISPONIBLE → LISTO PARA VENTA → RESERVADO → VENDIDO

### Leads
- Fuentes: chat coches.net (sync automático), llamada, WhatsApp, walk-in
- Estados: NUEVO → CONTACTADO → EN NEGOCIACIÓN → COMPRA / NO COMPRA
- Recordatorios automáticos por inactividad, **desactivables** al pasar a "no compra"

### Documentos generados por la app
1. Contrato de reserva (señal + expiración)
2. Contrato de compraventa
3. Mandato de gestoría (cambio nombre Tráfico)
4. **Provisional de circulación** — se pide a Gestoría Ruppmann (pendiente: ¿automatizar?)
5. Factura de venta (REBU o IVA 21%)

### Facturación
- Facturas emitidas: datos Ricard (autónomo), numeración correlativa F-YYYY-NNN
- Facturas recibidas: proveedor con CIF, concepto, base, IVA, total + adjunto
- Tipos: **REBU** (~90% de facturas, IVA sobre margen) o IVA normal 21%
- Libro facturas emitidas + recibidas, exportable CSV/Excel para gestoría

### Fiscal (autónomo)
- Trimestral: Modelo 303 (IVA), Modelo 130 (IRPF 20% beneficio)
- **Modelo 349**: compras intracomunitarias (Auto1 = CIF alemán). Tendencia 2026: menos compras pero no descartado
- Anual: Modelo 390 (resumen IVA) + Modelo 100 (IRPF)
- Dashboard: IVA acumulado, beneficio neto, IRPF estimado, alertas de plazos

## Pendiente

- Viabilidad de automatizar petición provisional circulación a Gestoría Ruppmann

## Sesiones de validación

- `docs/flujos_trabajo_validacion.html` — validación inicial 2026-04-03
- `docs/flujos_sesion_2026-04-04.md` — nuevas funcionalidades sesión 2026-04-04 (bot leads, rediseño stock, autocompletado reparaciones, seguro por días, formulario financiación)
