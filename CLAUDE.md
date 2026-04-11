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

## 🔴 SEGURIDAD — datos bancarios (bank_transactions)

> Migración 012 (2026-04-08) introduce las tablas `bank_accounts`,
> `bank_transactions` y `bank_category_rules` para integrar CaixaBank.
> Estos datos son **personales sensibles del mismo nivel que los DNIs**.

### Reglas absolutas

1. **NUNCA** crear endpoint público que devuelva `bank_transactions` (ni siquiera
   un campo individual: descripción, importe, contraparte). Todo el acceso
   pasa por la app autenticada y filtra por `company_id` desde la sesión.
2. **NUNCA** logear descripciones completas de movimientos en producción.
   Las descripciones contienen contrapartes (nombres de personas, conceptos
   privados). En logs, hashear o truncar a 8 chars + `…`.
3. **NUNCA** usar `getPublicUrl()` o exponer `bank_*` por Storage.
4. **NUNCA** incluir `bank_transactions` en exports masivos genéricos
   (`select * from ...`). Si hace falta exportar para gestoría, debe ser una
   acción explícita del usuario, filtrada por fecha, y registrada.
5. **Las RLS policies actuales** (`company_id = 1`) son permisivas a nivel
   cliente como el resto del proyecto. Cuando se haga el endurecimiento global
   de RLS, las tablas `bank_*` deben ser de las primeras en migrar a un
   modelo basado en `auth.uid()`.
6. **Cuenta personal de Ricard** (`bank_accounts.is_personal=true`):
   - SE IMPORTA pero NO se incluye en cómputos fiscales (303/130/390/100)
   - Hacienda **rechaza** mezclar gastos personales con la actividad de autónomo
   - El dashboard fiscal y los modelos deben filtrar `is_personal=false` por defecto
7. **Renovación PSD2 (Fase 3 GoCardless):** el consentimiento expira cada
   **90 días**. Es un límite legal, no se puede saltar. Banner de aviso
   obligatorio desde 7 días antes de `consent_expires_at`.

### Reglas de negocio bancarias (validado con Ricard 2026-04-08)

Ricard opera **EXCLUSIVAMENTE con CaixaBank** y tiene **3 cuentas**.
Confirmadas con últimos 4 dígitos de IBAN tras formulario `docs/banco_preguntas_ricard.html`:

| `bank_accounts.id` | alias               | IBAN     | tipo          | personal | uso |
|---|---|---|---|---|---|
| 1 | RICARD CODINA LUDEÑA  | ****2130 | checking      | **true** | particular, excluida del cómputo fiscal |
| 2 | CODINACARS            | ****5385 | checking      | false    | operativa: compras Auto1, ventas, Hacienda, TGSS |
| 3 | POLIZA CODINACARS     | ****7550 | credit_line   | false    | línea de crédito, disposiciones/reintegros |

**Decisiones de Ricard 2026-04-08 que aún no están implementadas pero hay que respetar cuando se haga:**
- Cuenta personal: importar SÍ pero filtrar del cómputo fiscal (`is_personal=true`)
- Histórico necesario: **2025+2026 completos** → N43 manual obligatorio (PSD2 solo da 90 días)
- PSD2 90d: OK, acepta renovar
- Email para registrar GoCardless en Fase 3: `codinacars@gmail.com`
- Compras a particulares en efectivo: **nunca** (no contamina)
- Bizum: lo recibe para **pagas y señales** → dejar como SIN_CATEGORIZAR para reconciliar manualmente
- Financiaciones de venta (Santander, Cetelem...): **el dinero entra 1-3 días después de la firma**, NO el mismo día. La ventana de match en `suggestPurchasesForTransaction` debe ampliarse de ±15 a ±21 días para captar este caso (TODO no aplicado todavía).

**Posible riesgo Fase 3:** GoCardless puede no soportar bien la cuenta póliza
de crédito porque no es cuenta corriente al uso. Verificar antes de Fase 3.

### Bloqueo conocido — descarga N43 desde CaixaBank Banca Premier

Validado 2026-04-08, Ricard usa **CaixaBank Banca Premier** (la interfaz de banca personal de alta gama, NO Línea Abierta Empresas):

- El módulo "**Cuaderno 43**" (URL `loc5.caixabank.es/GPeticiones/...`) **acepta peticiones**
  ("Operación realizada correctamente") pero el fichero generado **no aparece**
  en ningún sitio visible: ni MailBox, ni Mis certificados, ni se manda por
  email, ni se descarga al disco. Es un módulo pensado para Línea Abierta
  Empresas, en Banca Premier la "recepción de ficheros" no está expuesta.
  → **NO insistir** con Cuaderno 43 desde Banca Premier sin antes verificar
  que su contrato lo soporta.
- El **"Exportar Excel"** del menú `⋮` dentro de cada cuenta es la vía válida
  en Banca Premier, pero requiere validar paso a paso porque en la primera
  prueba con Ricard tampoco apareció en Descargas (causa pendiente de
  diagnosticar — puede ser popup bloqueado, formato real distinto, o requerir
  diálogo previo de email).
- **Plan B confirmado viable:** copy-paste de la tabla de movimientos del web
  a un Google Sheet, después parser CSV. Tedioso pero funciona seguro.
- **Plan C nuclear:** script Playwright que automatiza la navegación con
  sesión iniciada por Ricard. ~2h escribir, después funciona para siempre.

### Importación de extractos

- **Parser N43 (plan A, sin usar todavía):** `scripts/import_n43.py`. Si
  Ricard consigue alguna vez descargar un Cuaderno 43 real desde CaixaBank,
  ese es el camino más limpio. Uso:
  ```
  python scripts/import_n43.py --account-id 2 --file extracto.n43
  ```
- **Parser PDF CaixaBank Banca Premier (plan real, usado 2026-04-11):**
  `scripts/import_caixa_pdf.py`. Lo tiramos porque Banca Premier NUNCA
  suelta el N43 desde su interfaz (ver bloqueo arriba), pero sí permite
  pedir extractos en PDF por cuenta que llegan al email. Los PDFs usan
  una fuente subset (URWClassicSans-Bold) SIN ToUnicode CMap, así que
  `pdfplumber` y `pdfminer` extraen string vacío — **solo `pypdf` funciona**.
  Detalles críticos del parser:
  - Formato: 3 líneas por movimiento (fecha+concepto / oficina / importe+saldo EUR).
    Soporta tanto el formato nuevo (`INGRÉS CÀRREC SALDO` con EUR)
    como el antiguo (`+ INGRÉS - CÀRREC = SALDO` sin EUR al final).
  - **Signo**: el importe NO viene firmado en el PDF — la columna
    visual (INGRÉS vs CÀRREC) se pierde al extraer plano. El parser
    determina el signo por **delta del saldo** contra la fila siguiente
    en el tiempo. Para la primera fila del histórico (sin referencia
    previa) usa heurística `opening_positive` / `opening_negative`:
    si `saldo_after == ±amount_abs` asume saldo previo 0.
  - **Chunks**: CaixaBank trocea el histórico en varios PDFs
    `cuenta_XXXX.1.pdf` (más reciente) … `.6.pdf` (más antiguo). El parser
    los detecta por sufijo numérico y los concatena en orden cronológico
    antes de firmar, para que el encadenamiento de saldos sea continuo.
  - **Edge case**: en transferencias con data valor != data operació,
    CaixaBank imprime las dos fechas en líneas separadas y el concepto
    en una tercera línea. La máquina de estados del parser lo soporta
    (regex de fecha con concepto opcional).
  - Tests en `scripts/test_import_caixa_pdf.py` (17 tests con fixtures
    sintéticos que reproducen todos los casos patológicos — NO dependen
    de PDFs reales porque los PDFs bancarios no se commitean).
  - **Idempotente**: `external_id = sha1(account_id + date + amount_abs +
    saldo + concepto + meta)`. Se hashea `amount_abs` (no el importe
    firmado) para que el id sea estable incluso si el signo cambia
    entre corridas.
  - Uso:
    ```
    python scripts/import_caixa_pdf.py --account-id 1 --dir <carpeta_con_pdfs> --match "cuenta_2130*.pdf"
    python scripts/import_caixa_pdf.py --account-id 2 --dir <carpeta_con_pdfs> --match "cuenta_5385*.pdf"
    python scripts/import_caixa_pdf.py --account-id 3 --file cuenta_7550.pdf
    ```
  - Variables de entorno requeridas: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- **Fase 3 (futura):** edge function `sync-bank-caixa` vía GoCardless Bank
  Account Data (agregador PSD2 europeo, gratis, soporta CaixaBank).
- **Categorización automática:** las reglas viven en `bank_category_rules`
  (16 reglas seed en migration 012, con fix en migration 013), aplicadas
  en orden de prioridad. Cuando Ricard recategoriza algo a mano, se
  ofrecerá "crear regla" en Fase 2.
- **⚠ Regla al escribir nuevas reglas**: los conceptos que imprime CaixaBank
  mezclan **castellano y catalán** (`TRASPÀS PROPI` vs `traspaso propio`),
  y los importes de compra a Auto1 aparecen como `"TRF.INTERNACIONAL | 00046 / AUTO 1"`
  (con espacio). Las regex tienen que ser case-insensitive, aceptar el
  acento catalán (`trasp[àa]s`) y permitir espacios flexibles (`auto\s*1`,
  `mod[\.\s]+130`). Ver migration 013 como referencia.

## Pendiente

- Viabilidad de automatizar petición provisional circulación a Gestoría Ruppmann
- Descargar fotos importadas de coches.net (`source_url`) a Storage propio para
  poder transformarlas (~5 MB de bandwidth en el listado de Stock vienen de ahí)
- Lazy-load real con IntersectionObserver en el listado de Stock (mejora TTI
  aunque no `Finish`)

### Banco — pendientes (bloqueo histórico desbloqueado 2026-04-11)

~~1. Desbloquear la obtención del primer extracto real.~~ **DESBLOQUEADO 2026-04-11**:
Ricard envió los 13 PDFs de extracto por email (`[EXTERNAL] Fwd_ excel movimietnos.eml`).
Creado `scripts/import_caixa_pdf.py` que los parsea y firma los importes
por delta de saldos. **2651 movimientos importados** (2023-10-01 a 2026-04-09
en personal y empresa; 2025-03-26 a 2026-04-01 en póliza). Saldos finales
en BD cuadran al céntimo con los PDFs.

1. **Ampliar ventana de match** en `app/src/lib/api.ts:suggestPurchasesForTransaction`
   de `±15 días` a `±21 días` (cambio de 2 líneas, las dos `* 86400000`).
   Razón: financiaciones de venta tardan 1-3 días en abonarse según Ricard.
2. **Reconciliación entre cuentas — el caso del "puente 2024-2025"**:
   Durante **octubre 2024 – enero 2025** (4 meses, inicios de Ricard como
   autónomo), Ricard usó la cuenta personal 2130 como cuenta puente para
   las transferencias internacionales a Auto 1: traspasaba dinero desde
   empresa 5385 → personal 2130 y desde ahí mandaba la TRF.INTERNACIONAL.
   Total del periodo: **7 compras, 47.246,60 €**. El patrón está confirmado
   con los datos: 3 de las 4 fechas tienen un `TRASPÀS PROPI` entrante que
   cuadra con el importe de la TRF a Auto 1 el mismo día o 1-5 días antes
   (ej. 18-12-2024 entra +15.142,80, sale -7.288+-7.558 a Auto 1).

   **Contexto importante (no tratar como error grave):** fue la respuesta
   de un autónomo novato a un problema puntual de tesorería en la empresa,
   **no fraude ni dolo**. A partir de febrero 2025 NO hay más compras Auto 1
   desde personal — aprendió. En agosto 2025 empieza a usar la línea de
   crédito 7550 para las compras grandes (solución madura que descubrió
   después). Arco de aprendizaje limpio visible en el dataset.

   **Lo que sí hay que hacer en el dashboard fiscal:**
   - Esas 7 compras a Auto 1 siguen siendo compras intracomunitarias de la
     empresa (factura a CIF de CODINACARS, coches al stock, modelo 349)
     independientemente de que el dinero saliera por la personal. Ya las
     categorizamos como `COMPRA_VEHICULO` (migration 013 + recategorización).
   - Los `TRASPÀS PROPI` compensatorios (empresa → personal, entre
     oct 2024 y ene 2025, en torno a las fechas Auto 1) deben marcarse
     como `MOV_INTERNO` y neutralizarse entre sí con las TRF a Auto 1.
     El objetivo es que en el libro de IRPF y en el dashboard fiscal
     NI el traspaso ni la TRF aparezcan como gasto/ingreso extra — el
     único hecho fiscal es la compra intracomunitaria (modelo 349)
     que ya está bien atribuida a la empresa.

   Herramienta a construir: reconciliador automático que
   - Busca pares `(traspaso_entrante_personal, TRF_Auto1_saliente)` con
     fechas dentro de ±7 días e importes que cuadran (entrada ≥ salida),
     dentro del periodo problemático.
   - Los marca como `MOV_INTERNO` + anota en `notes` el par vinculado.
   - Alerta si hay TRF Auto1 en personal sin su traspaso compensatorio
     identificable — en esos casos hay que revisar manualmente con Ricard.
3. **Banco Fase 2**: editor categoría inline ya existe (commit 68f0b72),
   pero falta el botón "crear regla a partir de esta categorización" y
   `createPurchaseFromTransaction` en UI (helper en api.ts ya existe).
4. **Banco Fase 3**: edge function `sync-bank-caixa` con GoCardless. Email
   confirmado: `codinacars@gmail.com`. Bloqueo: registro en
   bankaccountdata.gocardless.com (gratis) y verificar que CaixaBank
   Particular + Empresas + Póliza están en su lista de instituciones.
5. **Script Playwright nuclear** (Plan C) como respaldo a la Fase 3 si
   GoCardless no soporta las 3 cuentas. Menos prioritario ahora que hay
   un pipeline funcional vía email+PDF.

### Migración cron sync-leads

7. **Migrar sync-leads de Windows Task Scheduler local a Supabase pg_cron.**
   Estado verificado 2026-04-08 vía MCP:
   - Código local: `supabase/functions/sync-leads/index.ts` (558 líneas) ✅
   - Edge function en Supabase: ❌ NO desplegada (solo `import-coches-net`
     existe, que es otra cosa)
   - `pg_cron` + `pg_net`: ✅ habilitados, hay 3 jobs activos como referencia
     (`process-email-queue` cada 5 min usa el patrón exacto que necesitamos)
   - Cron job para sync-leads: ❌ no creado
   - **Tarea local ahora silenciosa** (2026-04-09): la tarea `SyncLeadsCoches`
     ejecuta `sync_leads_silent.vbs` (wrapper VBScript con ventana oculta)
     en lugar del `.bat` directamente. Ya no muestra ventana de CMD.
   - **Gmail App Password creada por Ricard** (2026-04-09): Ricard generó una
     contraseña de aplicación siguiendo `docs/guia_configuracion_gmail.html`,
     pero la edge function usa **Gmail REST API con OAuth2** (no IMAP), así que
     la app password NO sirve. Ricard puede dejarla activa o borrarla.
   - **Guía OAuth2 enviada** (2026-04-09): `docs/guia_oauth2_gmail.html` — guía
     paso a paso para que Ricard configure Google Cloud Console + OAuth Playground
     y obtenga los 3 valores necesarios (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN).
     **Pendiente de que Ricard la complete.**
   Pasos pendientes:
   1. ~~Usuario: obtener credenciales OAuth2 Gmail~~ → guía enviada (`docs/guia_oauth2_gmail.html`),
      **esperando que Ricard la complete y envíe los 3 valores**
   2. Usuario: configurar 3 secretos en Supabase
      (`supabase secrets set` o Dashboard → Edge Functions → Secrets)
   3. Yo: deploy edge function con `verify_jwt=false`
   4. Yo: crear cron job pg_cron `*/5 * * * *` apuntando a la function URL
   5. Yo: invocación manual de prueba + verificar logs vía MCP get_logs
   6. Usuario: deshabilitar Task Scheduler local con
      `schtasks /delete /tn "SyncLeadsCoches" /f` cuando esté verificado

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
- Sesión 2026-04-08 (banco Fase 1): integración CaixaBank — migración 012 (bank_accounts/transactions/category_rules), parser N43 + 16 tests, BankList read-only, 3 cuentas Ricard sembradas (Personal/Autónomo/Póliza), 16 reglas categorización inicial. Plan completo en `~/.claude/plans/wondrous-tumbling-firefly.md`
- Sesión 2026-04-08 (banco Fase 2): reconciliación UI — resumen visual con barras por categoría (clickable filtra), tabla agrupada por mes con subtotales, editor categoría inline (dropdown), modal "vincular movimiento → compra existente" con sugerencias automáticas por importe ±5€ y fecha ±15 días, chip "✓ Banco" en `PurchasesList` para compras conciliadas. `api.ts` nuevos helpers: `suggestPurchasesForTransaction`, `listPurchaseIdsWithBankLink`, `createPurchaseFromTransaction`. Commit `68f0b72`
- Sesión 2026-04-08 (formulario Ricard): cuestionario HTML autocontenido `docs/banco_preguntas_ricard.html` enviado a Ricard, 3 cuentas confirmadas con últimos 4 IBAN, decisiones recogidas (ver sección "Reglas de negocio bancarias" arriba). Aliases actualizados en BD vía MCP
- Sesión 2026-04-08 (intento descarga N43): bloqueo CaixaBank Banca Premier — Cuaderno 43 acepta peticiones pero los ficheros no aparecen en MailBox/Mis Certificados/Descargas/email. Plan B y C documentados pero sin probar. Guía visual creada en `docs/guia_descargar_n43_caixabank.html` para Ricard
- Sesión 2026-04-09 (sync-leads): Ricard generó App Password Gmail (no sirve para la edge function que usa OAuth2 REST API). Creada guía OAuth2 `docs/guia_oauth2_gmail.html` para que Ricard obtenga CLIENT_ID/SECRET/REFRESH_TOKEN. Tarea programada `SyncLeadsCoches` convertida a silenciosa vía `sync_leads_silent.vbs` (sin ventana CMD visible)
- Sesión 2026-04-11 (banco import real): DESBLOQUEO del extracto inicial. Ricard envió 13 PDFs de CaixaBank por email. Creado `scripts/import_caixa_pdf.py` (parser pypdf con firma por delta de saldos, soporta formato antiguo/moderno, opening_negative para línea de crédito, máquina de estados forward para data valor en línea separada) + 17 tests unitarios con fixtures sintéticos. **Importadas 2651 movimientos** a `bank_transactions` (1299 personal + 1244 empresa + 108 póliza). Saldos finales cuadran al céntimo con PDFs. Migration 013 fix de 3 reglas de categorización buggeadas de 012 (`auto\s*1` con espacio, `mod[\.\s]+130` con punto+espacio, `trasp[àa]s` catalán). Re-categorizadas 244 filas. **Hallazgo operativo**: 7 compras Auto 1 por 47.246€ desde cuenta personal entre oct-2024 y ene-2025 (4 meses de inicios de autónomo, patrón "puente": traspàs empresa→personal + TRF.INT a Auto 1 el mismo día). Desde feb-2025 cero errores, y desde ago-2025 usa la línea de crédito 7550 como solución madura. Arco de aprendizaje limpio, NO tratar como error grave — el gestor ya declaró bien el modelo 349 (factura a CIF empresa). Pendiente: reconciliador automático que neutralice pares (traspàs compensatorio, TRF Auto 1) como MOV_INTERNO. PDFs borrados de disco tras importar (originales en el `.eml` de Downloads por si se necesitan)
