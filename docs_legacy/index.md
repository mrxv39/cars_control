# index

## Objetivo

App de escritorio **Cars Control** (Tauri 2 + React) para **Codina Cars** (compraventa de vehículos de segunda mano). Gestionar stock, y a medio plazo otros módulos (ventas, leads, clientes, citas, revisiones, anuncios, fiscal, gastos), según prioridad que definamos.
pero como hago que 
---

## Notas

- **Stock actual:** cada vehículo = una carpeta dentro de `data/stock` (ruta de la app: Windows `%APPDATA%\com.codinacars.carscontrol\data\stock`). Nombre de carpeta = nombre del vehículo; opcionalmente fotos .jpg/.jpeg para miniatura.
- **docs_legacy** en el repo (CODINACARS PC, FISCAL, GASTOS, etc.) es solo contexto histórico; la app no lo usa. Se puede usar en el futuro para importar o consultar.
- **Backend (Rust):** `create_vehicle`, `rename_vehicle`, `delete_vehicle`, `load_app_state`, `get_stock_folder_path`, `open_folder`, `get_vehicle_thumbnail`. Validación de rutas dentro de `data/stock`; nombres sanitizados; sufijos "(2)" si hay colisión.
- **Frontend:** lista de vehículos, modal crear/editar, eliminar con confirmación, "Abrir carpeta de datos", "Abrir carpeta" por vehículo, miniaturas.
- **Tests:** 12 tests unitarios Rust para `sanitize_vehicle_name`, `ensure_unique_vehicle_path`, `stock_vehicle_from_path`. Sin tests frontend ni E2E.
- **Auth:** no implementada; se dejó para después del CRUD. Opción: PIN o contraseña local al abrir la app si hace falta.

---

## Pendientes

- [x] CRUD completo de stock (crear, editar/renombrar, eliminar)
- [x] Tests unitarios backend
- [ ] Definir prioridad de siguientes módulos (ver Preguntas)
- [ ] Decidir si hace falta auth (ver Preguntas)

---

## Preguntas para definir

*(Responde lo que quieras; con eso actualizo Objetivo y Pendientes.)*

1. **Orden de siguientes funcionalidades**  
   En el análisis aparecen: Ventas (listado por año/mes), Leads, Clientes, Citas, Revisiones/ITV, Anuncios, Facturación, Fiscal, Gastos. ¿Cuál quieres que sea el **siguiente** después del stock? ¿Hay alguno que no te interese o que sea prioritario?

2. **Ventas**  
   ¿Quieres que la app lea las carpetas de `docs_legacy` (VENTAS 2023, 2024, etc.) solo para **listar y abrir**, o prefieres que las ventas futuras se registren desde la app (y dónde guardaríamos eso)?

3. **Leads y clientes**  
   ¿Los leads son “contactos interesados en comprar/vender” y los clientes “compradores o vendedores ya cerrados”? ¿Quieres un listado simple (nombre, teléfono, notas) o campos concretos (DNI, email, vehículo de interés, etc.)?

4. **Citas**  
   ¿Para qué las usarías? (pruebas de coche, entrega, revisión, etc.) ¿Solo fecha/hora y con quién, o también recordatorios?

5. **Revisiones / ITV**  
   ¿Quieres solo un aviso por vehículo (próxima ITV / próxima revisión) o también enlazar documentos (PDFs) que ya tengas en la carpeta del coche?

6. **Anuncios**  
   ¿Qué portales usas (Coches.net, etc.)? ¿Necesitas solo “este coche está publicado aquí, enlace” o también estado (publicado/cerrado) y fecha?

7. **Facturación / Fiscal / Gastos**  
   ¿Basta con “acceso rápido” a carpetas o PDFs (listar y abrir), o quieres que la app guarde algo (por ejemplo resumen de gastos por trimestre)?

8. **Auth**  
   ¿El PC donde corre la app es solo tuyo o compartido? Si es compartido, ¿quieres que la app pida PIN o contraseña al abrir?

---

## Enlaces

- [[ANALISIS_PROYECTO_Y_APP_TAURI]] — contexto del proyecto y roadmap por fases
- [[INFORME_ANALISIS_REPO]] — estado del repo y consistencia
- `app/README.md` — cómo instalar y ejecutar la app
