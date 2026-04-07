# Importador coches.net

> Validado con Ricard 2026-04-07. Coches.net es la fuente de verdad por ahora — Ricard publica primero allí, después llega a la app.

## Problema central: republicaciones

Ricard republica anuncios para refrescarlos (los anuncios viejos generan desconfianza). Esto significa:

- El `id` interno de coches.net **cambia** entre republicaciones del mismo coche.
- Coches.net **no expone matrícula ni VIN** públicamente → no hay identificador estable.
- Sin tratamiento, cada republicación se vería como un coche nuevo.

**Pendiente** (anotar para Ricard): preguntar al comercial de coches.net si algún plan resuelve la antigüedad del anuncio sin tener que despublicar/republicar manualmente.

## Modelo de datos

Separamos "coche físico" de "anuncio en coches.net":

```
vehicles (existente, ampliado)
  id, name, plate (matrícula, manual),
  vin (bastidor, manual),
  version, transmission, doors, seats,
  body_type, displacement, emissions_co2,
  environmental_label, description,
  equipment (jsonb)

vehicle_listings (NUEVA)
  id, vehicle_id (FK),
  external_source ('coches_net'),
  external_id (ej "70337034"),
  external_url,
  first_seen_at,
  last_seen_at,
  removed_at (NULL si sigue activo)

vehicle_videos (NUEVA)
  id, vehicle_id, url, provider ('youtube'/'mp4')
```

Un coche físico puede tener N listings históricos (uno por republicación). Métricas derivadas:

- **Días reales en stock** = `now - min(first_seen_at)` de todos los listings.
- **Veces republicado** = `count(listings)` por vehículo.
- **Coche problemático** = muchas republicaciones sin venta.

## Heurística de detección de republicaciones

Cuando un anuncio nuevo (id no visto) llega:

1. Buscar coches activos con `make + model + year + hp` iguales.
2. Si `km` está ±5% del candidato → match fuerte.
3. Si `precio` coincide o es cercano → confirma.

Si el match es muy alto (>95%), auto-vincular y notificar.
Si es dudoso, mostrar diálogo: *"¿Es nuevo o republicación de X?"* y Ricard decide.

## Fuentes de datos en el HTML

### Listado del concesionario
`https://www.coches.net/concesionario/codinacars/`

`window.__INITIAL_PROPS__` → `JSON.parse("...")` → `.vehiclesList.items[]`. Una sola petición trae todos los coches del perfil.

### Ficha de coche
`<script type="application/ld+json">` con `@type: ["Car","Product"]`. Una petición por coche.

## Mapping de campos

Validado con el usuario el 2026-04-07.

### vehicles

| Campo | Origen | Tipo |
|---|---|---|
| name | listing.make + listing.model | text |
| version | listing.version + pack | text (NUEVO) |
| anio | listing.year | int |
| km | listing.km | int |
| precio_venta | listing.price | numeric |
| fuel | listing.fuelType | text |
| cv | listing.hp | int |
| color | jsonld.color | text |
| transmission | jsonld.vehicleTransmission | text (NUEVO) |
| doors | jsonld.numberOfDoors | int (NUEVO) |
| seats | jsonld.seatingCapacity | int (NUEVO) |
| body_type | jsonld.bodyType | text (NUEVO) |
| displacement | jsonld.vehicleEngine.engineDisplacement | int (NUEVO) |
| emissions_co2 | jsonld.emissionsCO2 | text (NUEVO) |
| environmental_label | listing.environmentalLabel | text (NUEVO) |
| description | extraído del HTML | text (NUEVO) |
| equipment | jsonld.additionalProperty[] | jsonb (NUEVO) |

### vehicle_listings

| Campo | Origen |
|---|---|
| external_source | "coches_net" |
| external_id | listing.id |
| external_url | listing.url |
| first_seen_at | listing.creationDate o now() |
| last_seen_at | now() en cada importación |

### vehicle_photos

Las fotos se descargan a Supabase Storage (validado: queremos independencia de coches.net).
Origen: `jsonld.image[].url` (URLs en alta resolución).
Se añade `source_url` para auditoría.

### vehicle_videos (nueva tabla)

Si la ficha tiene vídeo, se guarda referencia. Provider: `youtube` o `mp4`.

## Flujo de importación

1. Ricard pulsa **"Importar desde coches.net"** en la vista de Stock.
2. Edge function `import-coches-net`:
   - Fetch del listado (con IP europea, edge functions Supabase ya están en EU).
   - Parse de `__INITIAL_PROPS__.vehiclesList.items`.
   - Para cada item: comprobar si su `external_id` ya existe en `vehicle_listings`.
     - Sí → actualizar `last_seen_at` y skip.
     - No → fetch de la ficha (sleep 2-3s entre fetches), parse JSON-LD, devolver detalle.
   - Detectar "removidos": coches en BD con listings activos cuyo external_id ya no aparece → marcar `removed_at` y badge "Revisar" en stock.
3. Frontend muestra modal con:
   - **N coches nuevos** (no vistos antes) — Ricard puede deseleccionar alguno.
   - **N republicaciones detectadas** con su candidato a vincular — Ricard confirma.
   - **N coches removidos** que ya no están en coches.net.
4. Ricard pulsa "Importar" → para cada coche confirmado:
   - Insert en `vehicles` (si nuevo) o crear nuevo `listing` apuntando al vehicle existente.
   - Descarga de fotos a Storage.
5. Logging: timestamp + counts en una tabla `import_logs` (futuro, no en v1).

## Frecuencia

Solo manual por ahora (validado). En el futuro: cron semanal opcional.

## Coches que desaparecen del listado

Solo marcar para revisión (badge "Revisar" en stock). No tocar el estado del vehículo automáticamente.

## Plan de implementación por fases

### Fase 1 — Base (esta tarea)
- Migración con columnas + tablas nuevas.
- Parser TS aislado (`cochesNetParser.ts`) con tests usando los HTMLs locales.
- Edge function `import-coches-net` que fetch + parse y devuelve JSON normalizado.
- Botón en Stock + modal de preview básico.

### Fase 2 — Refinamiento (futuro)
- Heurística de detección de republicaciones.
- Descarga de fotos a Supabase Storage en background.
- Soporte vídeo si aparece.
- Logging de importaciones.

### Fase 3 — Automatización (futuro)
- Cron semanal opcional.
- Notificación push si hay coches nuevos detectados.
