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
- Descargar fotos importadas de coches.net (`source_url`) a Storage propio para
  poder transformarlas (~5 MB de bandwidth en el listado de Stock vienen de ahí)
- Lazy-load real con IntersectionObserver en el listado de Stock (mejora TTI
  aunque no `Finish`)

## Performance — reglas para el listado de Stock

Validado 2026-04-08 tras llevar `StockTab` de **12.6s a 4.7s** de carga:

### Regla N+1: prohibido en vistas de listado

NUNCA hagas `Promise.all(ids.map((id) => api.fooByVehicle(id)))` en una vista
de listado. Con 30 coches eso son 30 round-trips serializados por las 6
conexiones HTTP del navegador. Usa siempre **una sola query batched con `.in()`**
y agrupa client-side.

Patrones aprobados:
- `getStockPhotoSummary(ids)` — fotos en bulk para el listado (ver `api.ts`)
- `getStockDocSummary(ids)` — solo `vehicle_id` + `doc_type`, SIN signed URLs
  (las URLs solo se generan en la vista de detalle, donde sí se usan)

### Regla: las cards de un listado NO hacen fetch propio

Las filas (`StockRow`, similares) deben recibir todo lo que pintan **por props**
desde el padre que ya hizo el preload batch. Si una card monta su propio
`useEffect` con `fetch...` por vehículo, multiplicas el N+1.

### Thumbnails con Storage Transforms (plan Pro)

`vehicle-photos` está en plan Pro de Supabase, con transforms habilitados.
Para el listado usar siempre `getPublicUrl(path, { transform: { width: 400, quality: 70 } })`.
Reduce el peso ~9× (779 KB → 86 KB típico). Para vista detalle se sirve el original.
El campo `VehiclePhoto.thumbUrl` ya hace esta transformación; el listado usa `thumbUrl`,
el detalle usa `url`.

Las fotos de coches.net importadas (`source_url`) NO se pueden transformar
porque son externas — `thumbUrl` es null en ese caso y el caller cae al original.

## Convenciones de fotos del vehículo

Validado Ricard 2026-04-08:

- **Foto principal** del coche en el listado de stock = la frontal-lateral 3/4
  (3/4 frontal con lateral izquierdo). NO una random.
- En la BD: `vehicle_photos.is_primary boolean`. Solo una `true` por vehículo.
- El listado usa la primaria si existe (`ORDER BY is_primary DESC, created_at`).
- En la ficha del vehículo, cada foto tiene un botón ★/☆ para marcar como principal.
- Heurística automática al importar del zip de Ricard: si hay un archivo
  llamado `1.jpg` / `1.jpeg`, se marca como principal (Ricard suele numerar
  así su foto hero).

## Sesiones de validación

- `docs/flujos_trabajo_validacion.html` — validación inicial 2026-04-03
- `docs/flujos_sesion_2026-04-04.md` — nuevas funcionalidades sesión 2026-04-04 (bot leads, rediseño stock, autocompletado reparaciones, seguro por días, formulario financiación)
- Sesión 2026-04-08: import zip stock, fusión coches.net+zip, foto principal, fix privacidad RGPD
- Sesión 2026-04-08 (perf): listado de Stock 12.6s → 4.7s — batch queries `.in()` + thumbnails Storage Transforms
