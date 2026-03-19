# Cars Control

App de escritorio con Tauri 2 + React + TypeScript para gestionar el negocio de Codina Cars.

## Prioridad actual

- `Ventas históricas`: ya disponible en modo solo lectura para listar y abrir carpetas reales desde `docs_legacy`.
- `Leads y Clients`: CRUD implementado y refinado con vínculo opcional a vehículo de stock.
- `Stock`: CRUD implementado con enlace opcional de anuncio por vehículo.
- Regla de producto: en ventas históricas, fiscal y gastos no se inventan registros; solo se muestra y abre lo que existe realmente en legacy.

## Estructura de datos (nueva)

La app **no pide seleccionar ninguna carpeta**. Usa por defecto su propia carpeta de datos:

- **Windows:** `%APPDATA%\com.codinacars.carscontrol\data\stock`
- **macOS:** `~/Library/Application Support/com.codinacars.carscontrol/data/stock`
- **Linux:** `~/.config/com.codinacars.carscontrol/data/stock` (o equivalente XDG)

Cada **subcarpeta** dentro de `stock` es un vehículo: se muestra su nombre y, si hay imágenes `.jpg` o `.jpeg` dentro (o en subcarpetas), la primera se usa como miniatura. El botón "Abrir carpeta" abre esa carpeta en el explorador del sistema.

Además del stock, la app guarda:

- `data/leads.json`: leads comerciales previos a compra.
- `data/clients.json`: clientes tras compra.
- `data/vehicle_ads.json`: metadatos opcionales del anuncio de cada vehículo (`url`, `status`, `date`).

Los leads pueden convertirse en clients desde la propia app. Tanto leads como clients pueden vincularse opcionalmente con un vehículo actual del stock. En stock, cada vehículo puede guardar un enlace de anuncio externo como Coches.net, junto con estado y fecha opcionales. No hay autenticación ni módulo completo de ventas en esta fase.

La carpeta **docs_legacy** del proyecto ahora se usa solo en modo lectura para `Ventas históricas`, `Fiscal` y `Gastos`: la app lista carpetas y archivos reales encontrados en legacy y permite abrir sus carpetas en el explorador. No modifica ningún archivo ni crea datos a partir de suposiciones.

La app incluye un botón `Exportar datos` en la barra lateral. Genera una copia de seguridad de `leads.json`, `clients.json` y `vehicle_ads.json` en `data/backups/backup-<timestamp>/`, junto con un `manifest.json` mínimo. No copia la carpeta de stock.

## Requisitos

- Node.js 20 o superior.
- Rust estable.
- Dependencias de Tauri 2 para Windows.

## Instalar y ejecutar

```bash
cd app
npm install
npm run tauri dev
```

## Build

```bash
cd app
npm run tauri build
```

El ejecutable y el instalador quedan en `app/src-tauri/target/release/`.

## Pendiente / roadmap corto

- `Ventas históricas`: hecho en modo lista y abrir carpeta; pendiente extraer más campos solo cuando la estructura sea inequívoca.
- `Leads y Clients`: hecho con vínculo opcional a vehículo y búsqueda/filtro en tiempo real por nombre, teléfono e interés/vehículo.
- `Exportar o copia de seguridad de datos`: hecho para `leads.json`, `clients.json` y `vehicle_ads.json` en `data/backups`.
- `Fiscal / Gastos`: hecho en modo solo lectura desde `docs_legacy` para listar y abrir carpetas reales.
- `Anuncios`: hecho el enlace manual por vehículo; pendiente cualquier automatización posterior si hace falta.
- `Citas / ITV / mantenimiento`: pendiente para fases posteriores.
- `Auth`: pendiente; la app sigue sin autenticación por decisión de producto.
