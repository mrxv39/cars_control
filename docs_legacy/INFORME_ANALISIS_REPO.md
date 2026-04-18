# Informe de análisis del repositorio cars_control

**Fecha:** Análisis realizado sobre el estado actual del repo.

---

## Resumen

- **Compilación:** Frontend (`npm run build`) y backend (Rust) compilan sin errores.
- **Inconsistencias corregidas:** 1 (estado de error cuando falla la carga).
- **Documentación:** Algunos documentos en raíz describen fases antiguas; la app actual está alineada con la estructura nueva (sin selección de carpeta, `data/stock`).

---

## 1. Backend (Rust) – `app/src-tauri/`

### Correcto
- **lib.rs:** Usa `app_data_dir()/data/stock`, crea la carpeta si no existe, sin referencias a `docs_legacy` ni configuración de ruta.
- **Comandos:** `load_app_state`, `get_stock_folder_path`, `open_folder`, `get_vehicle_thumbnail` registrados y sin dependencias obsoletas.
- **Cargo.toml:** No incluye `tauri-plugin-dialog`; solo `tauri`, `serde`, `serde_json`, `base64`.
- **Capabilities:** `default.json` solo tiene `core:default` (sin `dialog`).

### Nota
- La carpeta `target/` puede contener artefactos antiguos que referencian `tauri_plugin_dialog` (de compilaciones previas). No afecta al código actual. Si quieres limpiar: `cargo clean` en `app/src-tauri`.

---

## 2. Frontend (React + TypeScript) – `app/src/`

### Correcto
- **App.tsx:** Tipos `AppStatePayload` y `StockVehicle` coinciden con el backend. No usa `open` (dialog) ni `save_project_root`.
- **Invoke:** Argumentos en camelCase (`folderPath`, `path`) son correctos; Tauri 2 convierte a snake_case en Rust.
- **package.json:** No incluye `@tauri-apps/plugin-dialog`.

### Corregido en este análisis
- **Estado de error:** Si `load_app_state` fallaba, `appState` quedaba `null` y se renderizaba el contenido principal con `appState?.stock_folder` y lista vacía, lo que podía resultar confuso. Ahora, cuando `!appState` y no está cargando, se muestra una pantalla de error con mensaje y botón "Reintentar".
- **Uso de appState:** Tras el early return para `!appState`, el resto de la vista usa `appState` como no nulo (sin `?.` innecesarios en la rama principal).

---

## 3. Configuración

### Correcto
- **tauri.conf.json:** Título "Cars Control", identifier `com.codinacars.carscontrol`, puerto de dev 1422, `frontendDist`: `../dist`.
- **vite.config.ts:** Puerto 1422, `strictPort: true`, ignore de `src-tauri`.

---

## 4. Documentación en la raíz del proyecto

| Archivo | Estado |
|--------|--------|
| **ANALISIS_PROYECTO_Y_APP_TAURI.md** | Describe la estructura legacy (docs_legacy, CODINACARS PC) y fases MVP/Fase 0. La sección de Fase 0 ya no aplica tal cual (ya no se pide seleccionar carpeta). Útil como contexto del proyecto y roadmap; considerar añadir una nota al inicio: "La app actual usa solo data/stock en app_data_dir; docs_legacy es solo referencia." |
| **PROMPT_CODEX_MVP_TAURI.txt** | Prompt antiguo (selección de carpeta, docs_legacy). Sustituido por PROMPT_CODEX_APP_ESTRUCTURA_NUEVA.txt. |
| **PROMPT_CODEX_APP_ESTRUCTURA_NUEVA.txt** | Alineado con el comportamiento actual (sin carpeta, data/stock). |
| **app/README.md** | Describe la estructura actual (data/stock, sin selección de carpeta). Correcto. |

---

## 5. Estructura de carpetas del proyecto

- **docs_legacy:** Contiene CODINACARS PC, FISCAL, GASTOS, etc. La app no la usa; es solo contexto/legacy.
- **app:** App Tauri (frontend + src-tauri). Datos de la app en `%APPDATA%\com.codinacars.carscontrol\data\stock` (Windows).

---

## 6. Recomendaciones

1. **Opcional:** En la primera línea de `ANALISIS_PROYECTO_Y_APP_TAURI.md` añadir una nota indicando que la app actual usa solo `data/stock` y no pide seleccionar carpeta.
2. **Opcional:** Ejecutar `cargo clean` en `app/src-tauri` si quieres eliminar referencias antiguas a `tauri_plugin_dialog` en `target/`.
3. Para validar en local: `cd app && npm install && npm run tauri dev`. Comprobar que se crea la carpeta de datos y que "Abrir carpeta de datos" y "Recargar" funcionan.

---

## 7. Checklist de consistencia

| Revisión | Estado |
|----------|--------|
| Backend sin docs_legacy / project_root | OK |
| Frontend sin dialog ni save_project_root | OK |
| Tipos AppStatePayload / StockVehicle alineados | OK |
| Argumentos invoke (camelCase) compatibles con Rust | OK |
| Capabilities sin dialog | OK |
| Cargo.toml sin tauri-plugin-dialog | OK |
| package.json sin plugin-dialog | OK |
| Manejo de error cuando falla load_app_state | Corregido |
| Build frontend (npm run build) | OK |
| Build Rust (cargo check) | OK (recomendado ejecutar tras cambios) |
