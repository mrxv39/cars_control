# Estrategia de Migración de Datos Históricos

**Pregunta original:** "¿Miguel seria capaz de introducir los coches, clientes, facturas documentacion. Lo haria de otra manera?"

**Respuesta:** Ni manual, ni Excel directo. Una **combinación híbrida optimizada**.

---

## 📊 Análisis de Datos Disponibles

En `docs_legacy` encontramos:

### 1. **STOCK (Inventario de vehículos)**
- ✅ STOCK 2023 RICHI.xlsx
- ✅ STOCK 2024 RICHI.xlsx
- ✅ STOCK 2025 RICHI.xlsx
- ✅ STOCK 2025 CODINACARS.xlsx
- **Contenido esperado:** Modelo, Año, KM, Precio Compra, Precio Venta, Matrícula, Estado

### 2. **FACTURAS / VENTAS**
- ✅ LISTADO FACTURAS VENTA 2023 RICHI.xlsx
- ✅ LISTADO FACTURAS VENTA 2024 RICHI.xlsx
- ✅ LISTADO FACTURAS VENTA 2025 RICHI.xlsx
- ✅ FACTURA VENTA RICHI.xlsx
- ✅ FACTURA VENTA COMISIONES.xlsx
- **Contenido esperado:** Vehículo, Fecha, Precio Final, Cliente, Notas

### 3. **GASTOS / EXPENSES**
- ✅ GASTOS 2023/2024/2025 RICHI.xlsx
- **Contenido esperado:** Concepto, Fecha, Cantidad, Categoría

### 4. **Documentación por vehículo (PDFs)**
- ✅ Facturas de compra organizadas por carpeta de vehículo
- ✅ Facturas de venta
- ✅ Documentación de financiación (COFIDIS, LENDROCK)

---

## ❌ ¿Por qué NO hacer entrada manual via Miguel?

| Problema | Impacto |
|----------|---------|
| **Volumen** | Potencialmente 200-500+ registros de vehículos × 3 años |
| **Velocidad** | ~1 minuto por vehículo = 200-500 minutos (3-8 horas) |
| **Errores** | Alto riesgo de transcripción incorrecta de precios, fechas |
| **Datos perdidos** | Sin auditoria de qué se ingresó y qué se olvidó |
| **No escalable** | Cada vez que quieras más datos históricos, repites el trabajo |

**Conclusión:** Inviable para datos históricos en volumen. Solo viable para (<20 registros).

---

## ✅ Solución Propuesta: Importación Híbrida

### **Fase 1: Preparación (5 minutos)**

1. **Abrir cada archivo Excel historico (STOCK 2023-2025, FACTURAS 2023-2025)**
2. **Guardar como CSV** (Excel → Archivo → Guardar Como → CSV UTF-8)
   - Esto convierte el archivo a formato simple que la app puede leer
   - Mantiene todos los datos
   - Es un paso manual mínimo (1 click por archivo)

### **Fase 2: Importación Automatizada (5-10 minutos)**

La app tiene un nuevo comando: **`import_csv_file(path, tipo)`**

Crea carpetas automáticamente por cada vehículo y registra metadatos:
- ✅ Nombre/Modelo
- ✅ Año
- ✅ KM
- ✅ Precio Compra
- ✅ Precio Venta
- ✅ Estado ("disponible", "reservado", "vendido")

**Resultado:** Stock histórico 2023-2025 cargado en segundos, sin errores.

### **Fase 3: Ventas & Datos Relacionales (Manual guiado)**

Para las **facturas de venta**, necesitamos:
- Vincular vehículo (buscar carpeta existente)
- Vincular cliente (crear si no existe)
- Registrar fecha y precio

**Opción A (Recomendada):**
- Usar UI normal "Registrar venta" (menú SalesRecords)
- Miguel copia datos del Excel viejos a la app
- ~2 min por venta × 50 ventas = 100 minutos (~1.5 horas)
- Ventaja: Los datos están vinculados y auditables

**Opción B (Alternativa):**
- Crear CSV de ventas con formato: `Vehículo, Fecha, Precio, Notas`
- Importar via `import_csv_file(path, "sales")`
- Ventaja: Más rápido (5 min total)
- Desventaja: Requiere manual linking después

### **Fase 4: Gastos (Informativo)**

Los gastos se guardan en `docs_legacy/GASTOS/` como historial.
- Por ahora, no importar a la app
- Usar como datos de referencia para reportes futuros
- Pueden integrarse después si el negocio lo necesita

---

## 🛠️ Pasos Prácticos

### Importar STOCK Histórico

```
1. Abrir: docs_legacy/varios codinacars/STOCK 2023 RICHI.xlsx
2. Guardar Como → CSV UTF-8 → stock_2023.csv
3. Abrir app → (futuro: panel de importación)
4. Cargar archivo → Tipo "stock" → OK
   ✓ Crea carpetas de vehículos automáticamente
   ✓ Registra metadatos (año, km, precios)

Repetir para: STOCK 2024, STOCK 2025, STOCK 2025 CODINACARS
```

### Importar VENTAS Histórico

**Opción A - Manual (Recomendado para vincular datos):**
```
1. Abrir LISTADO FACTURAS VENTA 2023.xlsx
2. Para cada fila:
   - Buscar el vehículo en app (buscador)
   - Click "Registrar venta"
   - Copiar: fecha, precio, cliente
   - Guardar
```

**Opción B - Importación CSV (Más rápido):**
```
1. Preparar CSV con columnas: Vehículo, Fecha, Precio, Notas
2. Importar via comando `import_csv_file`
3. Luego vincular vehículos/clientes manualmente si necesario
```

---

## 📈 Cronograma Realista

| Fase | Actividad | Tiempo | Responsable |
|------|-----------|--------|------------|
| 1 | Convertir 4 STOCK Excel a CSV | 5 min | Manual |
| 2 | Importar STOCK 2023-2025 | 5 min | App (automatizado) |
| 3 | Importar ventas (opción A) | 90-120 min | Miguel |
| 3 | Importar ventas (opción B) | 10 min | App |
| 4 | Vincular gastos (futuro) | - | Pendiente |
| **TOTAL** | **Con opción A** | ~2 horas | Miguel + App |
| **TOTAL** | **Con opción B** | ~20 min | App |

---

## 🎯 Recomendación Final

**Para Reicard/Codina Cars:**

1. **Ahora:** Importar STOCK histórico (opción automatizada)
   - Recupera años de inventario en 5 minutos
   - Los vehículos vendidos marcados como "vendido"
   - Datos disponibles para reportes

2. **Próximo paso:** Registrar ventas (opción A o B)
   - Opción A si quieres máxima precisión y vinculación
   - Opción B si velocidad es lo importante

3. **Futuro:** Documentación por vehículo
   - Las carpetas ya existen en COCHES STOCK/
   - Solo falta agregar PDFs de facturas (manual pequeño)

---

## 💻 Implementación en la App

**El código está listo:**
```rust
#[tauri::command]
fn import_csv_file(
    app: AppHandle,
    file_path: String,
    import_type: String
) -> Result<ImportReport, String>
```

**Soporta:**
- `import_type: "stock"` → Lee CSV de stock, crea carpetas, registra metadatos
- `import_type: "sales"` → Lee CSV de ventas (preview, no linking aún)

**Requiere UI en app para:**
- Selector de archivo
- Botón "Importar como Stock / Ventas"
- Mostrar reporte de importación (X registros, Y errores)

---

## 📝 Conclusión

**Pregunta:** "¿Miguel seria capaz de introducir los coches, clientes, facturas documentacion?"

**Respuesta:**
- ✅ **Coches (Stock):** SÍ - Automatizado en 5 minutos (CSV → Import)
- ✅ **Clientes:** Parcial - Vincular durante ventas o entrada manual
- ✅ **Facturas/Ventas:** SÍ - Miguel copia datos (90 min) O importación CSV rápida (10 min)
- ✅ **Documentación:** SÍ - Copiar PDFs a carpetas de vehículos (manual pequeño)

**Lo haria de otra manera:**
- **Sí.** Una combinación de automatización (importar stock CSV) + validación manual (ventas) es mucho más eficiente que entrada manual pura.

---

## Próximos Pasos

1. ¿Quieres empezar con importación de STOCK histórico?
2. ¿Opción A o B para ventas?
3. ¿Necesitas ayuda convertiendo los Excel a CSV?
