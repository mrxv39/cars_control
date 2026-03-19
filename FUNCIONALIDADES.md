# 📋 Funcionalidades - Cars Control

**App de gestión para Codina Cars** — Herramienta integral para la compraventa y control de vehículos.

**Stack:** Tauri 2 + React 19 + TypeScript + Rust + SQLite

---

## 📑 Índice de Funcionalidades

1. [Dashboard](#-dashboard)
2. [Gestión de Stock](#-gestión-de-stock)
3. [Gestión de Leads](#-gestión-de-leads)
4. [Gestión de Clientes](#-gestión-de-clientes)
5. [Historial de Ventas](#-historial-de-ventas)
6. [Recordatorios](#-recordatorios)
7. [Informes y Reportes](#-informes-y-reportes)
8. [Historial de Notas](#-historial-de-notas)
9. [Gestión Fiscal y Gastos](#-gestión-fiscal-y-gastos)
10. [Integración de Datos](#-integración-de-datos)

---

## 📊 Dashboard

**Ubicación:** Primera pestaña de la app.

**Descripción:** Panel principal con estadísticas clave del negocio a tiempo real.

### Estadísticas Disponibles

- **Stock Total**
  - Vehículos disponibles
  - Vehículos reservados
  - Vehículos vendidos

- **Leads**
  - Leads activos
  - Leads cerrados
  - Leads perdidos
  - Leads sin seguimiento (>7 días)

- **Beneficio Potencial**
  - Suma de (precio_venta - precio_compra) para vehículos disponibles
  - Indicador visual de ganancia estimada

- **Últimas Novedades**
  - Últimos 5 leads agregados
  - Acceso rápido a información reciente

### Características

- ✅ Cálculos en tiempo real sobre datos en BD
- ✅ Interfaz visual intuitiva con tarjetas
- ✅ Permite identificar problemas rápidamente
- ✅ Datos actualizados automáticamente al cambiar registros

---

## 🚗 Gestión de Stock

**Ubicación:** Pestaña "Stock" en navegación.

**Descripción:** Administración completa del inventario de vehículos.

### Funciones Principales

#### 📝 Crear Vehículo
- Click en botón "Agregar Vehículo"
- Se abre modal con formulario
- Campos disponibles:
  - **Nombre** (obligatorio)
  - **Año de fabricación**
  - **Kilómetros**
  - **Precio de compra**
  - **Precio de venta** (usado para cálculo de beneficio)
  - **Estado** (disponible, reservado, vendido)
  - **Info de anuncio:**
    - URL de publicación
    - Estado del anuncio
    - Fecha de publicación

#### 🔍 Ver Detalles
- Cada vehículo se muestra como tarjeta
- Visualiza:
  - Foto/thumbnail del vehículo
  - Precio de compra y venta
  - Kilómetros y año
  - Estado actual
  - Información de publicidad

#### ✏️ Editar Vehículo
- Click en vehículo → modal de edición
- Modificar cualquier campo
- Cambios guardados en BD automáticamente

#### 🗑️ Eliminar Vehículo
- Opción en modal de edición
- Requiere confirmación
- Elimina también anuncios asociados

#### 🔎 Buscar/Filtrar
- Buscador en tiempo real por nombre de vehículo
- Filtrado por estado (disponible, reservado, vendido)

#### 📸 Gestión de Imágenes
- Carga automática de thumbnails desde carpetas
- Detección de primera imagen válida en folder
- Caché local para rendimiento

---

## 👥 Gestión de Leads

**Ubicación:** Pestaña "Leads" en navegación.

**Descripción:** Control de contactos interesados en vehículos.

### Funciones Principales

#### ➕ Crear Lead
- Modal con formulario completo
- Campos:
  - **Nombre** (obligatorio)
  - **Teléfono**
  - **Email**
  - **Vehículo de interés** (selecciona desde stock)
  - **Notas iniciales**
  - **Estado** (nuevo, contactado, negociando, cerrado, perdido)
  - **Canal** (Wallapop, coches.net, referido, etc.)
  - **Fecha de contacto** (cuándo llegó el lead)

#### 📞 Seguimiento de Leads
- Editar información de contacto
- Actualizar estado del lead en tiempo real
- Cambiar vehículo de interés
- Añadir o modificar notas

#### 📋 Historial de Notas
- **Timeline visual** de todas las interacciones
- Cada nota incluye:
  - Contenido del mensaje
  - Timestamp exacto (fecha y hora)
  - ID de la nota para referencia
- Capacidad de:
  - ➕ Agregar nuevas notas
  - 🗑️ Eliminar notas antiguas
  - 📝 Ver historial completo

#### 🎯 Filtrado Avanzado
- Buscar leads por nombre
- Filtrar por estado (nuevo, contactado, negociando, cerrado, perdido)
- Vista por canal de origen

#### 🔗 Conversión a Cliente
- Opción "Convertir a Cliente" en modal de lead
- Crea automáticamente registro de cliente
- Mantiene relación (source_lead_id)
- Datos pre-rellenados (nombre, teléfono, email)

---

## 🏢 Gestión de Clientes

**Ubicación:** Pestaña "Clientes" en navegación.

**Descripción:** Base de datos de clientes finales que compraron vehículos.

### Funciones Principales

#### 👤 Crear Cliente
- Modal con formulario
- Campos:
  - **Nombre** (obligatorio)
  - **Teléfono**
  - **Email**
  - **DNI**
  - **Notas especiales**
  - **Vehículo comprado** (vinculación)
  - **Origen** (puede venir de un lead convertido)

#### 📋 Gestionar Clientes
- Editar información del cliente
- Actualizar datos de contacto
- Modificar vehículo asociado
- Añadir notas

#### 🔍 Búsqueda
- Buscar clientes por nombre
- Filtrar por vehículo comprado

#### 📊 Información de Transacción
- Vinculación con vehículo comprado
- Historial de cliente (si viene de lead)
- Documentación asociada (DNI, contratos, etc.)

---

## 📈 Historial de Ventas

**Ubicación:** Pestaña "Historial de Ventas" en navegación.

**Descripción:** Registro detallado de todas las ventas completadas.

### Funciones Principales

#### ✅ Registrar Venta
- Crear registro de venta final
- Campos capturados:
  - **Vehículo vendido**
  - **Cliente** (opcional)
  - **Lead asociado** (opcional)
  - **Precio final de venta**
  - **Fecha de venta**
  - **Notas de transacción**
  - **Ruta de documentos** (contratos, DNI, etc.)

#### 📊 Visualizar Historial
- Tabla con todas las ventas
- Información de cada transacción:
  - Vehículo vendido
  - Cliente
  - Precio
  - Fecha
  - Ganancia (precio_venta - precio_compra)
  - Estado del pago

#### 📥 Descargar PDF
- Botón "Descargar PDF" en historial
- Genera reporte con:
  - Encabezado de empresa
  - Tabla de ventas
  - Resumen financiero
  - Total de ventas
  - Beneficio total

#### 🔍 Filtrado
- Buscar por vehículo
- Filtrar por rango de fechas
- Filtrar por cliente
- Filtrar por estado de pago

#### 📋 Detalles de Venta
- Ver detalles completos de cada venta
- Editar información
- Eliminar si es necesario

---

## 🔔 Recordatorios

**Ubicación:** Pestaña "Recordatorios" en navegación.

**Descripción:** Sistema de alertas para leads sin seguimiento reciente.

### Funciones Principales

#### ⏰ Identificación Automática
- Detecta leads sin contacto >7 días
- Diferencia por urgencia:
  - **CRÍTICO** (>14 días)
  - **URGENTE** (>7 días)

#### 📌 Vista de Recordatorios
- Lista de leads que necesitan seguimiento
- Muestra:
  - Nombre del lead
  - Vehículo de interés
  - Última fecha de contacto
  - Días sin contacto
  - Canales (Wallapop, coches.net, etc.)
  - Notas recientes

#### ✅ Marcar Contactado
- Click para registrar contacto
- Actualiza timestamp automáticamente
- Lead desaparece de la lista de recordatorios

#### 📞 Información de Contacto
- Teléfono directo visible
- Email visible
- Links para contactar rápidamente

#### 🎯 Priorización
- Leads críticos resaltados
- Ordenados por urgencia
- Facilita seguimiento eficiente

---

## 📄 Informes y Reportes

**Ubicación:** Pestaña "Historial de Ventas" (botón "Descargar PDF").

**Descripción:** Generación de reportes en formato PDF.

### Tipos de Informes

#### 📊 Reporte de Ventas Mensual
- **Contenido:**
  - Tabla de todas las ventas del período
  - Columnas: Fecha, Vehículo, Cliente, Precio, Ganancia
  - Resumen financiero:
    - Total de ventas
    - Cantidad de transacciones
    - Beneficio total
    - Promedio por venta

- **Características:**
  - PDF descargable
  - Formato profesional
  - Con marca de empresa
  - Fácil de imprimir

#### 💾 Formatos Soportados
- ✅ PDF (implementado)
- ⏳ Excel (en roadmap)

#### 📋 Información en Reportes
- Datos históricos de ventas
- Análisis de rentabilidad
- Datos de clientes
- Información de vehículos vendidos

---

## 📝 Historial de Notas

**Ubicación:** Modal de edición de Lead.

**Descripción:** Timeline visual de todas las notas y interacciones con un lead.

### Funciones Principales

#### ➕ Agregar Nota
- Campo de texto en panel de notas
- Botón para guardar
- Se registra automáticamente:
  - Contenido de la nota
  - Timestamp exacto
  - ID único de nota

#### 📅 Timeline Visual
- Cada nota en cronología
- Muestra:
  - Fecha y hora exacta (ISO 8601)
  - Contenido de la nota
  - Opción de eliminar
  - ID de referencia

#### 🗑️ Eliminar Nota
- Botón de eliminar en cada nota
- Requiere confirmación
- Nota se elimina de la BD

#### 🔍 Búsqueda en Notas
- Ver todas las notas de un lead
- Acceso rápido al historial
- Útil para revisar conversaciones

#### 💾 Persistencia
- Todas las notas guardadas en SQLite
- No se pierden datos
- Historial permanente

---

## 💼 Gestión Fiscal y Gastos

**Ubicación:** Pestañas "Fiscal / Gastos" en navegación.

**Descripción:** Acceso a estructura de carpetas para gestión de documentación fiscal.

### Funciones Principales

#### 📁 Navegación de Carpetas
- **Fiscal:** Acceso a documentación fiscal/impuestos
- **Gastos:** Registro de gastos operacionales
- Estructura de árbol de carpetas

#### 📄 Gestión de Documentos
- Listar archivos en carpetas
- Abrir archivos directo desde app
- Organización por período

#### 🔗 Integración con Ventas
- Documentos de ventas asociados
- Facturas y contratos
- Recibos de pago

#### 💾 Almacenamiento Local
- Documentos guardados en sistema de archivos local
- Seguridad: datos privados en local
- No requiere sincronización

---

## 🔄 Integración de Datos

**Descripción:** Capacidad de importar y migrar datos históricos.

### Funciones Implementadas

#### 📥 Importación Histórica
- Migración automática de JSON → SQLite
- Importación de:
  - **40 vehículos** (histórico 2023-2025)
  - **15 registros de ventas**
  - **2 clientes** (extraídos de facturas)
  - **Datos de leads** (importados de JSON)

#### 🗄️ Base de Datos SQLite
- Todas las lecturas desde BD
- Estructura optimizada:
  - Tabla `vehicles` (stock)
  - Tabla `leads` (contactos)
  - Tabla `clients` (clientes)
  - Tabla `lead_notes` (historial)
  - Tabla `sales_records` (ventas)
  - Tabla `sales_transactions` (transacciones detalladas)

#### 🔑 Índices de Rendimiento
- Índices en campos de búsqueda frecuente
- Optimización de consultas
- Mejora de velocidad de filtrado

#### 🔄 Compatibilidad
- `#[serde(default)]` en Rust
- Lee JSON antiguos sin errores
- Campos nuevos opcionales
- Migración sin pérdida de datos

---

## ⚙️ Características Técnicas

### Base de Datos

- **Motor:** SQLite (local, sin servidor)
- **Almacenamiento:** `app/src-tauri/data/cars.db`
- **Tablas:**
  - `vehicles` — Stock de vehículos
  - `leads` — Contactos/prospectos
  - `clients` — Clientes finales
  - `lead_notes` — Historial de notas
  - `sales_records` — Ventas registradas
  - `sales_transactions` — Transacciones detalladas

### API Tauri (Comandos Rust)

Comandos disponibles:

```
Backend Commands:
- get_app_state()              → Carga estado completo
- add_stock_vehicle()          → Crear vehículo
- update_stock_vehicle()       → Editar vehículo
- delete_stock_vehicle()       → Eliminar vehículo
- add_lead()                   → Crear lead
- update_lead()                → Editar lead
- delete_lead()                → Eliminar lead
- convert_lead_to_client()     → Convertir lead a cliente
- add_client()                 → Crear cliente
- update_client()              → Editar cliente
- delete_client()              → Eliminar cliente
- add_sales_record()           → Registrar venta
- get_sales_records()          → Listar ventas
- add_lead_note()              → Agregar nota
- get_lead_notes()             → Obtener notas de lead
- delete_lead_note()           → Eliminar nota
- get_vehicle_thumbnail()      → Obtener foto de vehículo
```

### Interfaz

- **Framework:** React 19 + TypeScript
- **Componentes:**
  - `DashboardView` — Panel principal
  - `StockView` — Gestión de vehículos
  - `LeadsView` — Gestión de leads
  - `ClientsView` — Gestión de clientes
  - `SalesView` — Ventas (legacy)
  - `SalesRecordsView` — Historial de ventas
  - `RemindersView` — Recordatorios
  - `LegacyView` — Fiscal/Gastos
  - `LeadModal` — Edición de leads (con notas)
  - `StockModal` — Edición de vehículos
  - `ClientModal` — Edición de clientes
  - `LeadNotesPanel` — Panel de historial de notas

---

## 📊 Flujos de Trabajo Principales

### Flujo 1: Nuevo Lead → Venta

1. **Lead llega** por Wallapop/coches.net/referido
2. **Crear Lead** en app con vehículo de interés
3. **Agregar Notas** con cada interacción
4. **Recordatorio** automático si >7 días sin contacto
5. **Convertir a Cliente** cuando se cierra la venta
6. **Registrar Venta** con precio final y documentos
7. **Reporte** visible en Historial de Ventas

### Flujo 2: Gestión de Stock

1. **Agregar Vehículo** a stock con precios
2. **Publicar en portales** (Wallapop, coches.net)
3. **Registrar URL** de publicidad
4. **Actualizar estado** (disponible → reservado → vendido)
5. **Cálculo automático** de beneficio en dashboard
6. **Historial** permanente en BD

### Flujo 3: Informes y Análisis

1. **Dashboard** muestra estadísticas en tiempo real
2. **Historial de Ventas** detallado
3. **Descargar PDF** para reportes
4. **Análisis de beneficios** y rentabilidad

---

## 🎯 Ventajas de la Solución

✅ **Local First** — Datos privados, sin sincronización
✅ **Offline** — Funciona sin conexión a internet
✅ **Rápido** — SQLite optimizado, índices de búsqueda
✅ **Intuitivo** — UI clara y fácil de usar
✅ **Completo** — Cubre todo el ciclo de venta
✅ **Flexible** — Fácil agregar campos nuevos
✅ **Robusto** — Validación de datos, sin duplicados

---

## 📅 Estado de Implementación

### ✅ Completado (100%)

- Dashboard con 6 estadísticas clave
- Gestión completa de stock
- Gestión completa de leads con notas
- Gestión de clientes
- Historial de ventas
- Recordatorios automáticos
- Informes PDF
- Importación de datos históricos
- SQLite integrado

### ⏳ En Roadmap

- Sincronización en la nube (OneDrive/Google Drive)
- Informes en Excel
- Integración con más portales
- Notificaciones desktop
- Estadísticas avanzadas

---

## 🔗 Acceso Rápido

- **Navegar:** Usa las 8 pestañas principales en el navegador
- **Buscar:** Campo de búsqueda en cada vista
- **Crear:** Botón "Agregar..." en cada sección
- **Editar:** Click en elemento para modal de edición
- **PDF:** Botón "Descargar PDF" en Historial de Ventas

---

**Última actualización:** 2026-03-18
**Versión:** 2.0 (SQLite + Features Avanzadas)
