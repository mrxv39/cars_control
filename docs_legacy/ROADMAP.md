# Cars Control – Hoja de Ruta

**App:** Tauri 2 + React 19 + TypeScript + Rust
**Objetivo:** Programa de gestión a medida para Codina Cars (compraventa de coches)

---

## 🎯 Estado Actual

- ✅ **FASE 1 (Completada)** — Refactorización base (monolito → componentes)
- ✅ **FASE 2 (Completada)** — Campos de negocio (precios, estado, seguimiento)
- ✅ **FASE 3 (Completada)** — Dashboard de inicio con stats y beneficio
- ⏳ **FASE 4 (Infraestructura lista)** — SQLite base + módulo db.rs funcional
- ✅ **FASE 5 (Features avanzadas - 3/5 completadas)**
  - ✅ Feature 1: Historial de notas por lead
  - ✅ Feature 2: Registro de ventas finales
  - ✅ Feature 3: Recordatorios - Leads sin seguimiento
  - ⏳ Feature 4: Informes PDF/Excel
  - ⏳ Feature 5: Sincronización en la nube

---

## ✅ FASE 1 – Refactorización Base

**Por qué:** App.tsx con 600+ líneas es difícil de mantener.

**Cambios realizados:**

### Estructura nueva
```
app/src/
├── App.tsx (260 líneas - solo nav + orquestación)
├── App.css (sin cambios)
├── types.ts (tipos centralizados)
├── hooks/
│   └── useAppState.ts (lógica de carga)
└── components/
    ├── StockView.tsx
    ├── LeadsView.tsx
    ├── ClientsView.tsx
    ├── SalesView.tsx
    ├── LegacyView.tsx
    ├── StockModal.tsx
    ├── LeadModal.tsx
    └── ClientModal.tsx
```

### Resultado
- ✅ App.tsx legible y testeable
- ✅ Componentes reutilizables
- ✅ CSS y comportamiento intactos
- ✅ Compila sin errores

---

## ✅ FASE 2 – Campos de Negocio

**Por qué:** El negocio necesita tracking de precios y seguimiento de leads.

### Stock (Vehículos)

Campos añadidos en Rust `StockVehicle`:
```rust
precio_compra: Option<f64>,      // Cuánto costó comprar
precio_venta: Option<f64>,       // Precio de venta marcado
km: Option<u32>,                 // Kilómetros
anio: Option<u16>,               // Año
estado: String,                  // "disponible" | "reservado" | "vendido"
```

Campos en TypeScript:
```typescript
interface StockVehicle {
  // ... campos existentes
  precio_compra?: number | null;
  precio_venta?: number | null;
  km?: number | null;
  anio?: number | null;
  estado?: string;
}
```

### Lead (Contactos)

Campos añadidos en Rust `Lead`:
```rust
estado: String,                  // "nuevo" | "contactado" | "negociando" | "cerrado" | "perdido"
fecha_contacto: Option<String>,  // Cuándo llegó el lead
canal: Option<String>,           // De dónde vino (Wallapop, coches.net, referido, etc.)
```

### UI Updates

**StockModal:**
- Campos año, km, precio compra, precio venta, estado

**LeadModal:**
- Select de estado del lead
- Input para canal (Wallapop, coches.net, etc.)
- Input date para fecha de primer contacto

**Tarjetas (Vista):**
- StockView: muestra precios y estado en las tarjetas
- LeadsView: muestra canal y fecha en líneas

### Compatibilidad
- `#[serde(default)]` en Rust → Lee JSON antiguos sin errores
- Nuevos campos son opcionales en TS
- Migración automática: datos faltantes usan valores por defecto

---

## ⏳ FASE 3 – Dashboard de Inicio

**Objetivo:** Reicard vea de un vistazo el estado del negocio.

### Qué mostrar
- Vehículos en stock (disponibles / reservados / vendidos)
- Leads activos vs cerrados/perdidos
- Leads sin seguimiento reciente (>7 días)
- Últimos 5 leads añadidos
- **Beneficio potencial** del stock: Σ(precio_venta - precio_compra)

### Implementación
- Nueva vista en nav: `"dashboard"` (primera pestaña)
- Cálculos en frontend sobre `appState` existente
- Comando Rust opcional si es necesario por rendimiento

### Archivos afectados
- `app/src/components/DashboardView.tsx` (nuevo)
- `app/src/App.tsx` — añadir tab dashboard
- `app/src-tauri/src/lib.rs` — comando opcional `get_dashboard_stats`

---

## ⏳ FASE 4 – Migración a SQLite

**Cuándo:** Cuando la app sea lenta o se necesite historial.

### Señales de que es tiempo
- Carga tarda >1 segundo
- Necesitan historial de cambios por lead/vehículo
- Filtros complejos (rango de precio, fecha, etc.)

### Plan
- Añadir `rusqlite` o `sqlx` a `Cargo.toml`
- Migración one-shot: leer JSON → insertar en SQLite
- Mantener comandos Tauri existentes (solo cambia persistencia)

### NO rompe
- Frontend (API de comandos Tauri sigue igual)
- Ningún código TypeScript

---

## ⏳ FASE 5 – Funcionalidades Avanzadas

Ideas para cuando el negocio lo pida:

### Historial de Notas
- Línea de tiempo por lead con todas las interacciones
- Quién, cuándo, qué se escribió

### Registro de Ventas
- Precio final, fecha, documentos
- Vinculación con lead + vehículo + cliente

### Recordatorios
- Leads sin contactar en X días
- Notificaciones en la app

### Informes
- PDF/Excel mensual de ventas
- Resumen de beneficios
- Estado del stock

### Gestión de Documentos
- Subida de ficheros por vehículo (carpetas ya existen)
- Solo falta la UI

### Sincronización en la Nube
- Backup automático a OneDrive/Google Drive
- Importante para no perder datos del negocio

---

## 🏗️ Arquitectura (Sin Cambios)

**Mantener:** Tauri + React + TypeScript

- ✅ App de escritorio nativa en Windows (sin servidor)
- ✅ Datos quedan en local (privacidad del negocio)
- ✅ Bajo coste de mantenimiento
- ✅ Fácil de distribuir

---

## 📋 Órdenes de Ejecución Recomendado

1. **Ahora** ✅ Fases 1 + 2 (refactorización + campos negocio)
2. **Siguiente sesión** → Fase 3 (dashboard)
3. **Cuando crezca** → Fase 4 (SQLite)
4. **Según demanda** → Fase 5 (features avanzadas)

---

## 🧪 Verificación

### Build
```bash
cd app && npm run build
# ✓ TypeScript compila sin errores
# ✓ Vite build exitoso (~225 KB gzip)
```

### Backend
```bash
cd app/src-tauri && cargo check
# ✓ Rust compila sin errores
# ✓ Structs actualizados correctamente
```

### Dev
```bash
cd app && npm run tauri dev
# Inicia app en modo desarrollo
# Todos los comandos funcionan (CRUD stock/leads/clients)
```

---

## 📝 Última Actualización

- **Fecha:** 2026-03-18 (Sesión 2)
- **Commits:** `8adedd4`, `54f8621`, `9f5e829`, `3f35baa`
- **Estado:** ✅ SQLite integrado, 40 vehículos importados, Feature 4 completada

---

## 📊 Sesión 2 (2026-03-18) - Resumen

En una sesión completamos:

### Implementado ✅
1. **Importación de datos históricos:**
   - 40 vehículos (STOCK 2023-2025)
   - 15 registros de ventas
   - 2 clientes extraidos de facturas

2. **Navegación mejorada:**
   - Integrados Recordatorios (RemindersView)
   - Integrados Historial de Ventas (SalesRecordsView)
   - Total 8 pestañas principales

3. **Feature 4 - Informes PDF:**
   - Librería jsPDF integrada
   - Botón "Descargar PDF" en Historial
   - PDFs con resumen financiero + tabla de ventas

4. **SQLite completo:**
   - Migración automática JSON → SQLite
   - Todas las lecturas ahora desde DB
   - Soporte para leads, clients, notes, sales_records

### Commits
```
8adedd4 Importación de datos históricos
54f8621 Integrar RemindersView y SalesRecordsView
9f5e829 Feature 4: Informes PDF/Excel
3f35baa Integración SQLite completa
```

---

## 🎓 Aprendizajes del Proyecto

### De FASE 1 (Refactorización)
- Descomponer monolitos en componentes React mejora mantenibilidad
- Usar hooks para lógica reutilizable (aquí: `useAppState`)
- TypeScript types centralizados en `types.ts` evitan duplicación

### De FASE 2 (Campos de Negocio)
- `#[serde(default)]` en Rust es clave para migrations sin breaking changes
- Nuevos campos como `Option<T>` permite leer datos viejos
- Mostrar info en tarjetas (no solo modales) mejora UX

---

## 🔗 Referencias Útiles

- **Tauri docs:** https://tauri.app/
- **React 19:** https://react.dev/
- **TypeScript:** https://www.typescriptlang.org/
- **Rust Serde:** https://serde.rs/

---

## 📊 Sesión 2026-03-18 - Resumen Ejecutivo

En una sola sesión se completaron **6 commits** implementando casi todo el roadmap:

### Implementado ✅
1. **FASE 3**: Dashboard con 6 estadísticas clave (stock, leads, beneficio, alertas)
2. **FASE 4**: Infraestructura SQLite completa (módulo db.rs + 15 funciones CRUD)
3. **FASE 5 Feature 1**: Historial de notas por lead (timestamps, timeline UI)
4. **FASE 5 Feature 2**: Registro de ventas finales (historial + resumen estadístico)
5. **FASE 5 Feature 3**: Recordatorios inteligentes (leads sin seguimiento >7 días)

### Cómo usar las nuevas features

**Dashboard:** Primera pestaña de la app, muestra stats en tiempo real.

**Lead Notes:** En LeadModal, verás un panel con historial de notas. Cada nota tiene timestamp y es deleteable.

**Sales Records:** Nuevo comando `add_sales_record` permite registrar venta final con precio y notas.

**Reminders:** Nueva vista que filtra leads activos sin contacto reciente, separados por urgencia.

### Commits de esta sesión
```
ebd7693 FASE 5 Feature 3: Recordatorios
eb28271 FASE 5 Feature 2: Registro de ventas
4097f66 FASE 5 Feature 1: Historial de notas
893e048 SQLite infrastructure
d295330 FASE 3: Dashboard
12d5a7e Documentación ROADMAP
c644b87 FASE 1 & 2: Base + Campos
```

---

## ❓ Preguntas Frecuentes

**P: ¿Dónde se guardan los datos?**
R: En `app/src-tauri/data/` — JSON en disco (actual). SQLite está listo para integración gradual.

**P: ¿Cómo agrego más campos a Stock o Lead?**
R: (1) Añade campo en Rust struct con `#[serde(default)]`, (2) Actualiza TypeScript interface, (3) Añade input en modal si quieres que sea editable.

**P: ¿Se pierden datos si actualizo?**
R: No. El `#[serde(default)]` asegura que JSON viejos cargan correctamente con los campos nuevos usando valores por defecto.

**P: ¿Cómo testiamos los cambios?**
R: `npm run tauri dev` inicia la app en modo desarrollo. Prueba CRUD en cada vista.

**P: ¿Cuándo activar SQLite completamente?**
R: Cuando la app tenga >1000 registros o necesites más rendimiento. El módulo está listo en `app/src-tauri/src/db.rs`.
