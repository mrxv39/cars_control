# app/ — Frontend React + Tauri

Shell desktop (Tauri v2) y web (Vite). Misma base de componentes React; el modo se detecta por hostname.

## Archivos grandes (referencia para agentes)

| Archivo | Líneas | Notas |
|---------|--------|-------|
| `src/WebApp.tsx` | ~403 | Shell web — routing, sidebar (login/búsqueda extraídos) |
| `src/App.tsx` | ~666 | Shell Tauri (desktop) — routing + panels |
| `src/components/web/LoginForm.tsx` | ~199 | Login, OAuth Google, recuperar contraseña |
| `src/components/web/GlobalSearchResults.tsx` | ~70 | Dropdown búsqueda global con filtros memoizados |
| `src/lib/api.ts` | ~117 | Fachada — re-exports de api-types, api-vehicles, api-bank, api-records |
| `src/lib/api-vehicles.ts` | ~287 | Vehículos, fotos, docs, inspecciones, import coches.net |
| `src/lib/translateError.ts` | ~11 | Traducción errores Supabase/red a mensajes usuario |
| `src/lib/toast.ts` | ~16 | Pub/sub toasts globales — import showToast() desde cualquier componente |
| `src/components/web/VehicleDetailPanel.tsx` | ~420 | Ficha vehículo: detalle, fotos, gastos, leads |
| `src/components/web/vehicle-detail/*.tsx` | ~473 total | VDFactura(26) + VDLeads(314) + VDPurchaseInfo(65) + VDVehicleDocs(68) |
| `src/components/web/StockList.tsx` | ~604 | Listado stock admin con filtros e import coches.net |
| `src/components/web/LeadsList.tsx` | ~554 | Listado leads con split-view, buscador, autoresponder |
| `src/components/BankList.tsx` | ~796 | Listado banco con categorización, editor inline, sugerencias |
| `src/components/web/RecordLists.tsx` | ~488 | Clientes, ventas, compras, proveedores (con búsqueda y paginación) |
| `src/components/web/PublicCatalog.tsx` | ~369 | Catálogo público, galería, contacto |
| `src/components/web/RevisionSheet.tsx` | ~333 | Hoja revisión vehículo + historial |
| `src/components/web/ProfileCompanyViews.tsx` | ~233 | Perfil usuario y datos empresa |
