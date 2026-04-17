# Flujo de compra de vehículo — CodinaCars

> Validado con Ricard — 2026-04-18.
> Consolida las respuestas de:
> - `Downloads/respuestas_flujo_compra_2026-04-17.md`
> - `Downloads/respuestas_ricard_compra_2026-04-17.md`
>
> Fuentes de referencia:
> - `docs/flujos_trabajo_validacion.html` §1 "Entrada de vehículo en stock"
> - `docs/flujos_sesion_2026-04-04.md`
> - `docs/import_coches_net.md`
> - `CLAUDE.md` (reglas de negocio y fiscales)

---

## 0. Origen del vehículo

Ricard compra desde **cinco canales**. El canal determina documentación, fiscalidad y pasos iniciales.

| Canal | Notas | Documento | IVA | Modelo 349 |
|---|---|---|---|---|
| **Auto1** (subasta alemana) | Frecuente | Factura Auto1 con CIF DE | Intracomunitario | **Sí** |
| **Particular** | Frecuente | Contrato compraventa + **autofactura Ricard** | Sin IVA (REBU al vender) | No |
| **Concesionario** (contactos) | Frecuente — le pasan coches conocidos | Factura con CIF ES | REBU o IVA 21% | No |
| **Subasta online española** | Frecuente | Factura con CIF ES | REBU o IVA 21% | No |
| **Empresa española** | Puntual | Factura con CIF ES | REBU o IVA 21% | No |

---

## 1. Decisión de compra (fuera de la app)

Paso manual de Ricard. La app **no** interviene todavía.

**Criterio principal:** margen esperado.

**Reglas heurísticas de Ricard:**
- Compra modelos que **conoce** y sabe que funcionan.
- Prioriza modelos que se **venden bien** en el mercado.
- Evita coches con historial de **problemas mecánicos** (motor sobre todo).

> Pendiente decidir: ¿calculadora de margen previo en la app? (precio compra + gastos estimados + margen objetivo → precio venta viable). Utilidad confirmada, implementación TBD.

---

## 2. Pago y factura de compra

- Pago desde cuenta bancaria de **empresa** (no `is_personal=true`).
- Factura de compra: PDF o foto — se conserva siempre.
- **Auto1**: factura con CIF alemán → activa modelo 349 al cierre de trimestre.
- **Particular**: **contrato de compraventa** firmado **+ autofactura emitida por Ricard** (siempre).
- **Concesionario / subasta ES / empresa**: factura estándar con CIF español.

---

## 3. Transporte y recepción

**Cómo llega el coche** — cuatro vías, según el caso:

| Vía | Cuándo |
|---|---|
| Ricard va a buscarlo | Si el coche está razonablemente cerca |
| Contratar transporte | Distancia larga o varios coches |
| Persona de confianza | Cuando Ricard no puede ir pero conoce a alguien en la zona |
| Auto1 entrega | Cuando aplica la opción del proveedor |

**Provisional de circulación** (Gestoría Ruppmann):
- Ricard la pide según necesidad. **No siempre** es imprescindible.
- Automatización desde la app: "depende" — evaluar caso a caso, no pedirla por defecto.

**Seguro por días** — `terranea-digital.es`
- Se contrata según necesidad, por decisión de Ricard.
- Momentos típicos de activación:
  - **Mover el coche al taller**
  - **Traer el coche** (Auto1 / recogida)
- Otros usos (visita, prueba, entrega) posibles pero no sistemáticos.

---

## 4. Alta en la app — registro de compra

Ricard registra la compra **al pagar**, aunque la factura aún no esté disponible.

**Flujo de registro en dos fases:**

### Fase A — al pagar (datos mínimos)
- **Proveedor** (selector)
- **Importe**
- **Vincular movimiento bancario** (la app sugiere el pago del banco que cuadra)

### Fase B — cuando llega la factura (días después)
- **Fecha factura**, **número factura**, **archivo** (PDF/foto)
- La mayoría llegan por **email** → extraer datos automáticamente del adjunto.
- Otras vías de recepción: papel, descarga web, WhatsApp.

**Por cada proveedor, guardar el canal habitual** de envío (email / papel / web / WhatsApp) para saber dónde ir a buscar la factura.

Modelo de datos actual: `PurchaseRecord` de tipo `COMPRA_VEHICULO` (`PurchasesView.tsx`, `LinkPurchaseModal.tsx`). Campos:
- `supplier_name`, `purchase_date`, `purchase_price`, `invoice_number`, `payment_method`, `source_file`, `notes`.

> **Mejoras pendientes derivadas de esta validación:**
> - Wizard en dos pasos (Fase A rápida al pagar, Fase B al tener factura).
> - Campo `invoice_channel` por proveedor (email/papel/web/WhatsApp).
> - OCR / parser de adjuntos de email para rellenar Fase B automáticamente.
> - Sugerencia automática de movimiento bancario al registrar compra.

---

## 5. Publicación en coches.net

1. Ricard sube el coche a **coches.net** (fuera de la app).
2. En la app pulsa **"Sincronizar stock"** → compara tienda coches.net vs stock local.
3. Importa con 1 click: fotos, precio, datos del anuncio.
4. Estado inicial: **DISPONIBLE**.

Una vez publicado, los **leads llegan solos desde coches.net** — es el canal principal de entrada.

Detalle técnico: `docs/import_coches_net.md` (republicaciones, matching, Edge Function `import-coches-net`).

---

## 6. Checklist de preparación (DISPONIBLE → LISTO PARA VENTA)

El vehículo pasa a **LISTO PARA VENTA** cuando se cumplen los 5 items:

- [ ] **40 fotos mínimo** — siempre 40 o más (no varía según gama).
- [ ] Ficha técnica (foto o PDF).
- [ ] Permiso de circulación (foto o PDF).
- [ ] Factura de compra — **puede llegar días después**; en ese caso, el vehículo avanza en el checklist pero la línea de factura queda como "pendiente de adjuntar" hasta que llega.
- [ ] Reparaciones finalizadas.

Orden de trabajo estándar: **Mecánica → Plancha → Limpieza** (limpieza siempre la última, salvo excepción).

🔒 **RGPD**: documentos sensibles al bucket privado `vehicle-docs` (RLS + signed URLs 1h). Nunca al público `vehicle-photos`. Ver `CLAUDE.md §Seguridad RGPD`.

---

## 7. Gastos asociados

### Por coche (se vinculan al vehículo)
- `TALLER`, `LIMPIEZA`, `TRANSPORTE`
- `GESTION_AUTO1`
- `RECAMBIOS`, `NEUMATICOS`, `COMBUSTIBLE`
- **Seguros por días puntuales** (cada activación de `terranea-digital.es`)
- `OTRO`

### Globales (no imputables a un coche concreto)
- **Publicidad** — cuota mensual global (coches.net pack / otros).

```
Coste total vehículo = purchase_price + Σ(gastos vinculados + seguros puntuales)
Margen esperado     = precio_venta – coste total  (actualizado en vivo)
```

> Pendiente decidir cómo imputar la publicidad mensual al margen: prorrateo por coche vendido, o dejarla como gasto general fuera del margen unitario.

---

## 8. Al vender — email automático a la gestoría

Cuando se cierra una venta, la app debe **mandar email a la gestoría** con todo lo necesario para tramitar el cambio de nombre:

- Factura de venta
- DNI del cliente
- Permiso de circulación
- Ficha técnica
- Contrato de compraventa
- Mandato de gestoría firmado

> Pendiente implementar: endpoint / edge function que componga y envíe ese email con los adjuntos del vehículo. Gestoría destino: Ruppmann.

---

## 9. Implicaciones fiscales

- **REBU** (~90% de ventas): IVA solo sobre el margen. Compra no genera IVA deducible.
- **IVA normal 21%**: cuando la factura de compra lleva IVA deducible.
- **Modelo 349** (intracomunitario): obligatorio en compras a Auto1 (CIF DE). Trimestre en que se hace la compra.
- **Modelo 303** (IVA trimestral) y **Modelo 130** (IRPF 20% trimestral).

Detalle: `flujos_trabajo_validacion.html §3` (Facturación) y `§4` (Impuestos).

---

## 10. Resumen visual del ciclo

```
[Decisión manual] → [Pago + alta en app Fase A] → [Transporte + (provisional)]
                           ↓
              [Llega factura → Fase B: adjuntar + completar]
                           ↓
  [Publicar coches.net] → [Sync → DISPONIBLE] → [Checklist 5/5] → [LISTO PARA VENTA]
                           ↓
              (gastos + seguros puntuales vinculándose en paralelo)
                           ↓
                    [Venta → email a gestoría]
```

**Estado del vehículo:**
`DISPONIBLE → LISTO PARA VENTA → RESERVADO → VENDIDO`

---

## 11. Pendientes derivados de esta validación

1. **Wizard de alta de compra en 2 fases** (Fase A al pagar, Fase B al tener factura).
2. **Campo `invoice_channel` por proveedor** (email / papel / web / WhatsApp).
3. **Sugerencia de movimiento bancario** al registrar compra (match con `bank_transactions`).
4. **OCR / parser de emails** para extraer datos de facturas recibidas.
5. **Email automático a gestoría** al cerrar venta (con todos los adjuntos del vehículo).
6. **Integración `terranea-digital.es`** para contratar seguros por días desde la app (si tiene API).
7. **Calculadora de margen previo** para decidir antes de comprar.
8. **Prorrateo de publicidad mensual** en el margen unitario (decisión pendiente).
9. Automatizar provisional de circulación (Ruppmann) — **evaluar caso a caso**, no por defecto.
