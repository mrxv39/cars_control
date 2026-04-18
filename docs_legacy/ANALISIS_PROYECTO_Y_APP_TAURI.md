# Análisis del proyecto Codina Cars y propuesta de app Tauri

> **Nota (estado actual de la app):** La app en `app/` usa solo la carpeta de datos de Tauri (`app_data_dir()/data/stock`). No pide al usuario seleccionar ninguna carpeta. La carpeta **docs_legacy** del proyecto es solo contexto histórico; la app no la usa.

## 1. Estructura actual del proyecto (carpetas como “base de datos”)

El proyecto **cars_control** es en la práctica la “base de datos” de **Codina Cars** (compraventa de vehículos de segunda mano): todo está organizado en carpetas y archivos, sin base de datos formal.

### 1.1 Raíz del proyecto

| Carpeta / elemento      | Contenido principal |
|-------------------------|----------------------|
| **CODINACARS PC**       | Operativa: stock, ventas, compras, facturas, financiación |
| **ESCANER**             | Documentos escaneados |
| **FISCAL**              | Documentación fiscal por año y trimestre |
| **GASTOS**              | Gastos por trimestre (PDFs numerados) |
| **varios codinacars**   | Varios (contraseñas, más ventas, certificados, etc.) |

---

### 1.2 CODINACARS PC (núcleo operativo)

#### COCHES STOCK (stock actual)
- **Una carpeta por vehículo.**  
  Nombre típico: trimestre + marca/modelo + matrícula + notas, ejemplos:
  - `1ºT DACIA DOKKER 2020`
  - `4ºT. MAZDA CX30 OK`
  - `3ºT .SKODA fabia (pieza nym)`
  - `z.BMW E30 325, B6246JW`
- **Dentro de cada carpeta:**
  - **Fotos:** `fotos definitivas`, `fotos provis`, numeradas (1.jpg … 50.jpg, .jpeg).
  - **Documentación:** factura compra, ficha técnica, permiso circulación, libro digital.
  - **Reparaciones/mantenimiento:** PDFs o docs (reparación abril, diciembre, ITV, etc.).
  - **Financiación:** cuando aplica (ej. FINANCIACION VICTOR CX, certificados bancarios).

#### VENTAS (histórico por año)
- **VENTAS 2023**, **VENTAS 2024**, **VENTAS 2025**, **VENTAS 2026**.
- Dentro: **por mes** (ej. `1. ENERO`, `2. FEBRERO`, `10 OCTUBRE`).
- Dentro de cada mes: **carpeta por venta** (vehículo + matrícula), con:
  - Documentación de venta.
  - Financiación (certificado titularidad, recibo domiciliado, justificantes, etc.).

#### COMPRAS / ENTREGAS
- **COMPRAS , OK , prueba:** contratos (Contracte CVVO, mandatos, etc.).
- **ENTREGAS:** contrato compraventa, mandatos (docx, pdf).

#### FACTURAS COMPRA - VENTA
- Plantillas: FRA COMPRA RICHI, FACTURA VENTA RICHI (xlsx), FACTURA VENTA COMISIONES.
- Facturas concretas (ej. FACTURA VENTA V25-03.pdf).

#### SIMULADOR FINANCIACIONES
- Excels COFIDIS, LENDROCK (por tramos de importe).

#### Otros en CODINACARS PC
- HOJA RESERVA RICHI.docx, logo codina cars.jpg.
- Carpetas: 347 2025, cartas certificadas hacienda, CERTIFICADO DIGITAL, COCHES NET CONTRATOS, COCHES VENDIDOS ANTES AUTONOMO, contraseña office, CONTRATOS ARVAL Y BBVA, VARIOS 23,24,25, ZZZ. RANDOM CARPETAS.

---

### 1.3 FISCAL
- **Por año:** 2023, 2024, 2025.
- **Por trimestre:** 1T, 2T, 3T, 4T.
- **Documentos:** modelo 130, 303, 349, 390, IAE, renta (100, 115, 180), datos fiscales.
- **varios fiscal:** alta autónomos, IAE, certificados (corriente pagos AET/SS), titularidad, contrato alquiler, SEPA, recibos.

---

### 1.4 GASTOS
- **GASTOS DE LOS 4 TRIMESTRES 2025:** por trimestre (1º T, 2º T, 3º T, 4º T).
- Dentro: PDFs numerados (1p.pdf, 2p.pdf, … 50p.pdf, etc.).
- **GATOS 1ºT 26** (probablemente “Gastos 1ºT 26”).

---

## 2. Qué hay hoy vs qué quieres en la app

| Necesidad en la app | ¿Existe ya en carpetas? | Dónde / cómo |
|---------------------|--------------------------|---------------|
| **Stock**           | Sí                       | COCHES STOCK (carpeta por coche + fotos + docs) |
| **Leads**           | No explícito             | No hay carpeta “leads”; habría que crear entidad y, opcional, carpeta o DB |
| **Clientes**        | Implícito                | Nombres en carpetas de ventas/financiación; no hay listado unificado |
| **Citas**           | No                       | A implementar desde cero |
| **Revisiones/ITV**  | Parcial                  | Algunos PDFs en carpetas de coches (mantenimientos, ITV) |
| **Anuncios**        | No                       | No hay carpeta “anuncios”; a implementar (portal, enlace, estado) |
| **Facturación**     | Sí                       | FACTURAS COMPRA - VENTA (plantillas + PDFs) |
| **Fiscal**          | Sí                       | FISCAL (año → trimestre → modelos) |
| **Gastos**          | Sí                       | GASTOS (trimestre → PDFs) |
| **Ventas**          | Sí                       | VENTAS AÑO → MES → carpeta venta |
| **Compras/Entregas**| Sí                       | COMPRAS, ENTREGAS |
| **Financiación**    | Sí                       | Simuladores + docs en ventas/stock |

---

## 3. Fase 0: Lo más sencillo posible (MVP)

**Objetivo:** que el cliente pueda **empezar a usarlo ya**, con el mínimo de pantallas y opciones. El resto de funcionalidades se irán añadiendo poco a poco.

### 3.0 Principios

- **Una cosa bien hecha** mejor que muchas a medias.
- **Cero base de datos** en la primera versión: solo leer carpetas y abrir archivos.
- **Una sola pantalla útil** al abrir la app (más, si acaso, una de configuración la primera vez).
- **Sin login**, sin permisos, sin sincronización: app local y directa.

### 3.1 MVP en concreto (Fase 0)

1. **Pantalla de configuración (solo la primera vez)**  
   - El usuario elige la carpeta raíz del proyecto (donde está `CODINACARS PC`, `FISCAL`, etc.).  
   - Se guarda en un archivo de config local (ej. en la carpeta de la app).  
   - Si ya está configurado, la app abre directo en la pantalla principal.

2. **Una sola pantalla principal: Stock**  
   - Lista de **coches en stock**: cada fila = una carpeta dentro de `CODINACARS PC\COCHES STOCK`.  
   - Se muestra el **nombre de la carpeta** tal cual (sin parsear aún trimestre/matrícula si complica).  
   - En cada fila: botón **“Abrir carpeta”** que abre esa carpeta en el Explorador de Windows.  
   - Opcional pero muy útil: mostrar **una miniatura** (la primera foto .jpg/.jpeg de la carpeta) para reconocer el coche rápido.  
   - Nada más: sin editar nombres, sin facturas, sin ventas en esta fase.

3. **Navegación mínima**  
   - Barra o menú con: **Stock** (y más adelante se añaden “Ventas”, “Leads”, etc.).  
   - Por ahora solo Stock está activo; el resto puede estar visible pero deshabilitado o oculto.

### 3.2 Qué NO lleva el MVP

- No SQLite (leads, clientes, citas, anuncios → más adelante).
- No Ventas, Fiscal, Gastos, Facturación en la primera versión.
- No edición de datos: solo lectura y “abrir carpeta”.
- No subida de archivos ni creación de carpetas desde la app.

### 3.3 Resumen Fase 0

| Qué hace el cliente | Cómo |
|---------------------|------|
| Configurar la ruta del proyecto | Una vez, al empezar (o desde un menú Configuración). |
| Ver todos los coches en stock | Lista con nombre de carpeta y, si se puede, una foto. |
| Abrir la carpeta de un coche | Un clic en “Abrir carpeta” → se abre en el Explorador. |

Con eso ya puede **sustituir** “ir a la carpeta CODINACARS PC, entrar en COCHES STOCK y buscar a ojo”. El resto se va completando en fases siguientes.

---

## 4. Propuesta de app Tauri (completa, para más adelante)

Objetivo a medio plazo: **una app de escritorio (Tauri)** que unifique control de stock, leads, clientes, citas, revisiones, anuncios, facturación, fiscal y gastos, usando **los mismos paths de carpetas** como “origen de la verdad” y, donde haga falta, una **base de datos local** (SQLite) para cosas que hoy no existen en carpetas.

### 4.1 Stack sugerido
- **Tauri 2** (Rust + ventana nativa).
- **Frontend:** React o Vue (o Svelte) + TypeScript.
- **Base de datos local:** SQLite (ej. `sqlx` o `rusqlite` en Rust; en el front, acceso vía comandos Tauri) — **a partir de Fase 1**, no en el MVP.
- **Rutas de datos:** configurar una “raíz del proyecto” (ej. `c:\...\cars_control`) y que la app lea/lista carpetas y enlace documentos.

### 4.2 Módulos de la app (tras el MVP)

1. **Stock**
   - Listar carpetas de `CODINACARS PC/COCHES STOCK` como “vehículos”.
   - Parsear nombre de carpeta → trimestre, marca/modelo, matrícula (heurístico o manual la primera vez).
   - Mostrar fotos (lista de jpg/jpeg de la carpeta), ficha, permiso, factura compra, reparaciones/ITV.
   - Enlaces “Abrir carpeta” / “Abrir documento” (abrir con el programa por defecto del SO).

2. **Ventas**
   - Listar por año/mes desde `VENTAS 202x` → mes → carpetas.
   - Cada carpeta = una venta (vehículo + matrícula); enlazar documentación y financiación igual que en stock.

3. **Leads**
   - Nuevo: tabla en SQLite (nombre, teléfono, email, origen, vehículo de interés, estado, notas).
   - Opcional: carpeta “LEADS” con subcarpeta por lead y adjuntos.

4. **Clientes**
   - Nuevo: tabla en SQLite (nombre, contacto, DNI/NIF, direcciones, notas).
   - Relación opcional con ventas (por nombre o por ID de venta guardado).

5. **Citas**
   - Nuevo: tabla en SQLite (fecha, hora, tipo, cliente/lead, vehículo, notas, recordatorio).

6. **Revisiones / ITV**
   - Opción A: por vehículo de stock, campo “próxima ITV” / “última revisión” en SQLite (vinculado a carpeta de coche).
   - Opción B: leer desde PDFs en la carpeta del coche (si más adelante se quiere parsear texto).
   - Listado “próximas ITV” y alertas.

7. **Anuncios**
   - Nuevo: tabla en SQLite (vehículo [ref. stock], portal [Coches.net, etc.], URL, fecha publicación, estado).
   - Enlazar vehículo a carpeta de COCHES STOCK.

8. **Facturación**
   - Listar/abrir plantillas y facturas en `FACTURAS COMPRA - VENTA`.
   - Opcional: registro en SQLite de “factura X asociada a venta Y”.

9. **Fiscal**
   - Listar por año/trimestre desde `FISCAL` y abrir PDFs (130, 303, 349, 390, IAE, renta).
   - Recordatorios por trimestre (presentaciones).

10. **Gastos**
    - Listar por trimestre desde `GASTOS` y abrir PDFs (1p, 2p, …).
    - Opcional: resumen por trimestre (número de justificantes, importe si se extrae después).

11. **Compras / Entregas**
    - Listar y abrir documentos de `COMPRAS` y `ENTREGAS` (contratos, mandatos).

12. **Simulador financiación**
    - Enlaces a los Excel en `SIMULADOR FINANCIACIONES` o, si quieres, integración básica (abrir fichero con parámetros).

### 4.3 Flujo de datos

- **Solo lectura sobre carpetas (recomendado al inicio):** la app no renombra ni mueve carpetas; solo lista, parsea nombres y abre archivos. Así no se rompe el flujo actual.
- **Escritura solo en SQLite:** leads, clientes, citas, anuncios, revisiones/ITV, y relaciones “este registro → esta carpeta de stock/venta”.
- **Configuración:** path raíz del proyecto (ej. `C:\Users\Usuario\Desktop\proyectos\cars_control`), y opcionalmente paths de CODINACARS PC, FISCAL, GASTOS para no hardcodear.

### 4.4 Orden sugerido de desarrollo (después del MVP)

1. **Fase 0 (MVP):** Proyecto Tauri + pantalla de configuración (ruta) + **solo Stock** (lista + abrir carpeta + opcional miniatura).
2. **Fase 1:** Mejorar Stock (detalle, fotos, documentos, “abrir archivo”) + módulo **Ventas** (listado año/mes/venta).
3. **Fase 2:** SQLite + **Leads** y **Clientes** (CRUD).
4. **Fase 3:** **Citas** (CRUD + lista o calendario).
5. **Fase 4:** **Revisiones/ITV** y **Anuncios**.
6. **Fase 5:** **Facturación, Fiscal, Gastos** (listados y enlaces).
7. **Fase 6:** Compras/Entregas y Simulador.

---

## 5. Resumen

- La “base de datos” actual son **carpetas y archivos** (stock, ventas por año/mes, facturas, fiscal, gastos, compras, entregas, simuladores).
- **No hay** estructura explícita para leads, clientes, citas ni anuncios; eso se modelaría en **SQLite** dentro de la app.
- La app Tauri puede **apoyarse en la estructura actual** (leyendo rutas y enlazando documentos) y **añadir** control de leads, clientes, citas, revisiones/ITV y anuncios en base de datos local, sin tener que migrar de golpe todos los PDFs y fotos.

**Para empezar:** conviene implementar solo la **Fase 0 (MVP)**: app Tauri con configuración de ruta + una pantalla de Stock (lista de carpetas + “Abrir carpeta” + opcional miniatura). Así el cliente puede usarla desde el primer día y el resto se va completando por fases.
