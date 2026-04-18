# Cars Control - Contexto para Agente

## Estado actual (2026-03-22)

App Tauri 2 + React 19 + TypeScript + Rust + SQLite para gestion de compraventa de coches.
Funcional con: Dashboard, Stock, Leads, Clientes, Ventas, Compras, Proveedores, Recordatorios.

## Tareas completadas hoy (2026-03-22)

### T01 - Pulir flujo del primer coche real [ux] - COMPLETADO
- Modal de crear vehiculo muestra campos de año, km, precio compra y venta en grid 2 columnas
- Boton "Añadir vehiculo" es primary en vez de secondary
- Badge de estado (reservado/vendido) visible en tarjetas de stock
- Empty state simplificado sin jerga tecnica
- Rama feature/ux-primer-coche-real mergeada a main

### T02 - Activar recordatorio de leads sin contactar [feature] - COMPLETADO
- Dashboard siempre muestra tarjeta "Leads sin contactar" (no solo cuando hay pendientes)
- Incluye leads sin fecha_contacto en el conteo (excluye estados finales)
- Boton "Ver recordatorios" navega directamente a la vista de Recordatorios
- Verde cuando todo esta al dia, rojo cuando hay pendientes
- Rama feature/leads-reminder-visible mergeada a main

### T06 - Auditar datos reales de clientes [seguridad] - COMPLETADO
- AUDITORIA_SEGURIDAD.md con hallazgos detallados
- .gitignore mejorado: data/, backups/, .env.*, *.log, .coverage
- clients.json eliminado del tracking git (contenia DNIs reales)
- Rama feature/security-audit mergeada a main
- CRITICO pendiente manual: rotar Supabase anon key, limpiar historial git con BFG

## Sesión 2026-03-22 (séptima ejecución)
Sin tareas pendientes. Las 3 tareas asignadas (T01, T02, T06) ya estaban completadas y mergeadas a main desde ejecuciones anteriores.

## Proximo paso sugerido
- Ejecutar acciones manuales de seguridad (rotar Supabase anon key, BFG para limpiar historial git)
- Probar flujo completo de crear vehiculo con la app en dev
- Verificar que el dashboard muestra correctamente los leads sin contactar
