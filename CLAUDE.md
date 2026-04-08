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

## 🔴 SEGURIDAD — RGPD / privacidad de datos personales

> Incidente 2026-04-08: una foto de DNI se publicó accidentalmente en el catálogo
> público porque el script de import clasificó cualquier `.jpg` como vehicle_photo.
> Esta sección es para que NUNCA vuelva a pasar.

### Buckets y políticas

- **`vehicle-photos`**: PÚBLICO (catálogo de coches en venta). Solo deben ir aquí
  fotos genuinas del vehículo (exterior, interior, motor, daños). NUNCA fotos
  de DNIs, contratos, certificados, dni del cliente, nóminas, etc.
- **`vehicle-docs`**: **PRIVADO** (RLS sin SELECT público). Documentos sensibles:
  facturas, contratos, DNIs, fichas técnicas, permisos de circulación, nóminas,
  vida laboral. Acceso solo desde la app autenticada vía **signed URLs** de 1h.
  NO usar `getPublicUrl()` para este bucket NUNCA.

### Patrones de nombres SIEMPRE sensibles

Si el nombre de un archivo contiene cualquiera de estas palabras (case-insensitive),
**NO va a `vehicle-photos` aunque sea `.jpg/.png`**, va a `vehicle-documents`:

> dni · nie · pasaporte · carnet · certificado · titularidad · iban · cuenta ·
> nomina · nómina · vida laboral · renta · irpf · recibo · domiciliac ·
> seguridad social · contrato · compraventa · padron · empadronam

Mantenido en `scripts/analyze_zip_stock.py:SENSITIVE_NAME_PATTERNS` —
si añades patrones nuevos aquí, actualízalos también allí.

### Reglas para Claude

1. **NUNCA** subir un archivo con nombre sensible al bucket `vehicle-photos`.
2. **NUNCA** cambiar `vehicle-docs` a público (RLS o flag `bucket.public`).
3. **NUNCA** reemplazar `createSignedUrl()` por `getPublicUrl()` en
   `listVehicleDocuments()` o `uploadVehicleDocument()`.
4. **Antes de hacer un import masivo de archivos**, verificar nombres con la
   lista de patrones sensibles.
5. **Si encuentras un archivo sensible mal ubicado**: borrarlo del bucket público
   inmediatamente, moverlo al privado, avisar al usuario.

## Pendiente

- Viabilidad de automatizar petición provisional circulación a Gestoría Ruppmann

## Sesiones de validación

- `docs/flujos_trabajo_validacion.html` — validación inicial 2026-04-03
- `docs/flujos_sesion_2026-04-04.md` — nuevas funcionalidades sesión 2026-04-04 (bot leads, rediseño stock, autocompletado reparaciones, seguro por días, formulario financiación)
