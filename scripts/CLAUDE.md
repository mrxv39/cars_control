# Scripts — Detalle de implementación

## Parser PDF CaixaBank Banca Premier

`scripts/import_caixa_pdf.py` — usado 2026-04-11 para importar los extractos reales.

Ricard usa **CaixaBank Banca Premier** (banca personal de alta gama, NO Linea Abierta Empresas).
Banca Premier NUNCA suelta el N43 desde su interfaz, pero sí permite pedir extractos en PDF
por cuenta que llegan al email. Los PDFs usan fuente subset (URWClassicSans-Bold) SIN
ToUnicode CMap — **solo `pypdf` funciona** (pdfplumber y pdfminer extraen string vacío).

### Detalles del parser
- Formato: 3 líneas por movimiento (fecha+concepto / oficina / importe+saldo EUR).
  Soporta formato nuevo (`INGRÉS CÀRREC SALDO` con EUR) y antiguo (`+ INGRÉS - CÀRREC = SALDO` sin EUR).
- **Signo**: importe NO viene firmado en el PDF. El parser determina el signo por
  **delta del saldo** contra la fila siguiente en el tiempo. Primera fila usa heurística
  `opening_positive` / `opening_negative`.
- **Chunks**: CaixaBank trocea el histórico en varios PDFs `cuenta_XXXX.1.pdf` (más reciente) …
  `.6.pdf` (más antiguo). El parser los concatena en orden cronológico antes de firmar.
- **Edge case data valor**: en transferencias con data valor != data operació, CaixaBank imprime
  las dos fechas en líneas separadas. La máquina de estados del parser lo soporta.
- **Idempotente**: `external_id = sha1(account_id + date + amount_abs + saldo + concepto + meta)`.
  Se hashea `amount_abs` (no importe firmado) para estabilidad.
- Tests en `scripts/test_import_caixa_pdf.py` (17 tests con fixtures sintéticos).

### Uso
```
python scripts/import_caixa_pdf.py --account-id 1 --dir <carpeta> --match "cuenta_2130*.pdf"
python scripts/import_caixa_pdf.py --account-id 2 --dir <carpeta> --match "cuenta_5385*.pdf"
python scripts/import_caixa_pdf.py --account-id 3 --file cuenta_7550.pdf
```
Variables de entorno: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

## Parser N43

`scripts/import_n43.py` — plan A, sin usar todavía. Si Ricard consigue descargar un Cuaderno 43
real desde CaixaBank, es el camino más limpio.
```
python scripts/import_n43.py --account-id 2 --file extracto.n43
```

## Bloqueo N43 CaixaBank Banca Premier

El módulo "Cuaderno 43" (`loc5.caixabank.es/GPeticiones/...`) acepta peticiones pero el fichero
NO aparece en ningún sitio (MailBox, Mis certificados, email, disco). El módulo está pensado para
Línea Abierta Empresas, en Banca Premier la recepción de ficheros no está expuesta.
→ **NO insistir** con Cuaderno 43 sin verificar que el contrato lo soporta.

Alternativas:
- **Plan B**: copy-paste tabla movimientos web → Google Sheet → parser CSV
- **Plan C**: script Playwright que automatiza navegación con sesión de Ricard

## Reglas para escribir regex de categorización bancaria

Los conceptos CaixaBank mezclan **castellano y catalán** (`TRASPÀS PROPI` vs `traspaso propio`).
Las regex deben ser case-insensitive, aceptar acento catalán (`trasp[àa]s`) y espacios flexibles
(`auto\s*1`, `mod[\.\s]+130`). Ver migration 013 como referencia.
