# app/ — Frontend React + Tauri

Shell desktop (Tauri v2) y web (Vite). Misma base de componentes React; el modo se detecta por hostname.

## Archivos grandes (referencia para agentes)

| Archivo | Líneas | Notas |
|---------|--------|-------|
| `src/WebApp.tsx` | ~375 | Shell web — routing, sidebar (login/búsqueda extraídos) |
| `src/components/web/LoginForm.tsx` | ~199 | Login, OAuth Google, recuperar contraseña |
| `src/components/web/GlobalSearchResults.tsx` | ~70 | Dropdown búsqueda global con filtros memoizados |
| `src/lib/api.ts` | ~115 | Fachada — re-exports de api-types, api-vehicles, api-bank, api-records |
| `src/lib/api-vehicles.ts` | ~286 | Vehículos, fotos, docs, inspecciones, import coches.net |
| `src/lib/translateError.ts` | ~11 | Traducción errores Supabase/red a mensajes usuario |
| `src/lib/toast.ts` | ~16 | Pub/sub toasts globales — import showToast() desde cualquier componente |
| `src/components/web/VehicleDetailPanel.tsx` | ~420 | Ficha vehículo: detalle, fotos, gastos, leads |
| `src/components/web/vehicle-detail/*.tsx` | ~175 | VDFactura, VDLeads, VDVehicleDocs, VDPurchaseInfo (subsecciones) |
| `src/components/web/StockList.tsx` | ~560 | Listado stock admin con filtros e import coches.net |
| `src/components/BankList.tsx` | ~549 | Listado banco con categorización |
| `src/components/web/RecordLists.tsx` | ~488 | Clientes, ventas, compras, proveedores (con búsqueda y paginación) |
| `src/components/web/PublicCatalog.tsx` | ~369 | Catálogo público, galería, contacto |
| `src/components/web/RevisionSheet.tsx` | ~333 | Hoja revisión vehículo + historial |
| `src/components/web/ProfileCompanyViews.tsx` | ~233 | Perfil usuario y datos empresa |
