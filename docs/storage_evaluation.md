# Evaluación: Supabase Storage vs Google Drive

> Validado pendiente con Ricard. Anotado para revisión 2026-04-08.

## Estado actual

- **Backend**: Supabase Storage en el plan gratuito.
- **Buckets**: `vehicle-photos` (671 fotos importadas) + `vehicle-docs` (55 PDFs).
- **Tamaño actual**: ~233 MB.
- **Límite free tier**: 1 GB.

## Comparativa

| Criterio | Supabase Storage | Google Drive |
|---|---|---|
| **Coste free tier** | 1 GB total + 5 GB transfer/mes | **15 GB** total compartidos con Gmail+Drive |
| **Coste plan pago** | $0.021/GB/mes + $0.09/GB transfer ($25/mes Pro = 100 GB + 250 GB transfer) | $1.99/mes 100 GB · $9.99/mes 2 TB |
| **Integración con la app** | Nativa: 1 línea de código (`supabase.storage.from(...).upload()`) | Requiere OAuth + Google Drive API + tokens refresh + manejo de carpetas |
| **URLs públicas** | Directas, instantáneas, con CDN | Requieren cambiar permisos del archivo a "cualquiera con el link", y la URL no es estable si se mueve |
| **Velocidad de upload** | Rápida (mismo proveedor que la BD) | Más lenta (API REST con cuotas) |
| **Velocidad de display** | CDN de Supabase | Más lenta y con quota de descargas |
| **Cuotas / rate limits** | Generosas en plan pago | API limitada a 1000 req/100s por usuario, sólo 20k uploads/día |
| **Compartir con cliente final** | URLs públicas o firmadas | Compartir manual del archivo |
| **Búsqueda interna** | SQL sobre `vehicle_photos` / `vehicle_documents` | Search via API, más complejo |
| **Backup** | Manual o vía dump SQL | Drive ya hace backup propio |
| **Privacidad** | RLS policies por bucket | Permisos por archivo |
| **Familiaridad de Ricard** | No conoce el panel | Ya usa Drive para muchas cosas |
| **Acceso desde móvil** | Vía la app | Vía Drive app nativa (Ricard ya la tiene) |
| **Vinculación con la app** | 1 fuente de verdad (BD + Storage) | 2 fuentes (BD + Drive) — riesgo de desincronizar |

## Riesgos de cada opción

### Riesgos Supabase Storage
- Si el plan free se queda corto (>1 GB), pasar a Pro son **$25/mes** mínimo.
- Si Ricard quiere ver/editar archivos sin abrir la app, tiene que entrar al panel de Supabase (no es amigable).

### Riesgos Google Drive
- **Complejidad técnica alta**: hay que implementar OAuth, refresh tokens, manejo de carpetas, gestión de permisos por archivo, sincronización con la BD.
- **Vendor lock-in indirecto** con Google.
- **Dos fuentes de verdad**: si Ricard borra/mueve un archivo en Drive sin avisar a la app, la BD queda inconsistente.
- Cuotas API más restrictivas.
- La URL que guardamos en BD puede romperse si Ricard mueve el archivo en Drive.

## Recomendación

**Mantener Supabase Storage como backend principal** por estas razones:

1. Ya funciona, ya integrado, ya tenemos 233 MB importados sin coste.
2. Una sola fuente de verdad (BD + Storage en el mismo proveedor).
3. URLs estables, CDN, RLS por bucket.
4. La complejidad de Drive (OAuth + carpetas + cuotas) **no compensa** los 14 GB extra del free tier.
5. Cuando lleguemos al límite del free tier, plan Pro de Supabase ($25/mes) cubre 100 GB, suficiente para muchos años de stock de coches.

## Alternativa híbrida (futura)

Si Ricard quiere acceso desde Drive **además** de la app, podemos hacer un **export periódico** (cron diario o semanal) que sincroniza los archivos de Supabase Storage a una carpeta de Drive. Es lectura unidireccional (Supabase → Drive) y mantiene Supabase como single source of truth.

Eso lo evaluamos si Ricard lo pide explícitamente más adelante.

## Decisión a confirmar con Ricard

> **¿Mantenemos Supabase Storage o invertimos tiempo en migrar a Google Drive?**
>
> Mi recomendación: mantener Supabase Storage. Si más adelante quieres acceso desde Drive como espejo, lo añadimos como sync unidireccional.
