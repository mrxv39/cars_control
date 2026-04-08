# Demo Ricard — integración bancaria CaixaBank

**Reunión:** 2026-04-08 15:00
**Branch:** `wo/005-stock-checklist`
**Estado BD:** 30 movimientos demo en cuenta Autónomo (id=2), 2 ya vinculados a compras reales para mostrar chips desde el inicio.

---

## 🎯 Objetivos de la demo

1. Mostrar a Ricard que SU negocio aparece en la app: marzo 2026 con sus ingresos, gastos, gestoría, TGSS, IVA, gasolina.
2. Validar el modelo de las 3 cuentas (Personal / Autónomo / Póliza).
3. Hacer la reconciliación de un movimiento en directo (-11000€ SEAT Ibiza).
4. Recoger las 4 decisiones pendientes para desbloquear Fase 2.5 y Fase 3.

---

## 📋 Guion paso a paso (5 minutos)

### 1. Abrir la web local y entrar como Ricard
- `cd app && npm run dev` (si no está ya)
- Login → ir a la nueva pestaña **Banco** del menú lateral

### 2. Selector de cuentas
- Mostrar las 3 cuentas: **Personal**, **Autónomo**, **Póliza CodinaCars**
- Click en **Personal** → aparece el aviso amarillo "esta cuenta es personal, no entra en cómputos fiscales"
- Volver a **Autónomo**

### 3. Resumen visual del periodo
- **Ingresos / Gastos / Neto** del mes
- **Distribución por categoría** con barras (compras, gestoría, IVA, IRPF, gasolina, comisiones, autónomo, etc.)
- Click en una barra → filtra solo esa categoría. Click otra vez → quita filtro.

### 4. Tabla agrupada por mes
- Marzo 2026 / febrero 2026 / enero 2026 con sus subtotales propios
- Cada movimiento tiene **categoría editable inline** (dropdown)
- Las que no se han categorizado aparecen en **amarillo "Sin categorizar"**

### 5. ⭐ Reconciliación en directo (el momento clave)
- Buscar el movimiento del **5/3/2026 -11.000 €** "TRANSFERENCIA EMITIDA JUAN MANUEL RAMOS BOHORQUEZ"
- Está sin categorizar y sin vincular → click en botón **"Vincular →"**
- Se abre el modal y muestra **automáticamente** la compra real del SEAT Ibiza a Juan Manuel Ramos (también -11.000€, mismo día)
- Click → vinculado. El chip cambia a **"✓ vinculado"**.
- Ir a la pestaña **Compras** → la compra del SEAT Ibiza ahora tiene chip **"✓ Banco"** en la columna nueva.
- Mostrar también las 2 compras de IBERSPORT (MAZDA CX-3) que ya estaban pre-vinculadas como ejemplo.

### 6. Preguntas críticas (mientras estás en la pantalla)
- "Mira, así se vería tu actividad de marzo. ¿Reconoces los importes?"
- "Estos 30 movimientos son sintéticos para la demo, los borraremos. Para los reales necesito que descargues el N43 desde CaixaBank Web (te enseño cómo)."
- "¿Qué cuentas hay que conectar exactamente? Te puse 3, ¿confirmas alias?"

---

## ❓ 4 preguntas pendientes para Ricard

1. **Cuenta personal: ¿se importa o ni siquiera se conecta?**
   - Mi propuesta: importar pero `is_personal=true` filtra del cómputo fiscal. Le permite ver su caja personal en la app sin contaminar 303/130.
   - Decisión: ☐ importar y filtrar / ☐ no conectar

2. **GoCardless (Fase 3): ¿bajo qué email registramos la cuenta?**
   - bankaccountdata.gocardless.com → registro gratis
   - Opciones: ☐ codinacars@gmail.com / ☐ email personal de Ricard / ☐ email Mauro

3. **Histórico inicial: ¿desde cuándo?**
   - GoCardless solo da ~90 días. Para más histórico hay que importar N43 manualmente.
   - Decisión: ☐ último año fiscal completo (2025-2026) / ☐ últimos 90 días bastan

4. **Cuenta póliza de crédito: ¿la conectamos?**
   - GoCardless puede no soportarla bien (no es cuenta corriente al uso).
   - Si no funciona vía API, ¿N43 manual basta o no merece la pena?
   - Decisión: ☐ sí, intentar / ☐ solo N43 / ☐ no la necesitamos en la app

---

## 🎁 Extras a mostrar si sobra tiempo

- Cambiar la categoría de un movimiento "sin categorizar" → se queda guardada
- Filtros: "solo sin vincular" + buscar "REPSOL" → ves todas las repostadas
- Hacer click en una barra del gráfico de categorías → tabla se filtra
- Exportar a CSV (Fase 2.5 — pendiente, no demo todavía)

---

## 🧹 Limpieza después de la reunión

Cuando hayamos terminado, **borrar los movimientos de demo** para que no contaminen la BD real:

```sql
-- Run vía MCP execute_sql en proyecto hyydkyhvgcekvtkrnspf
-- Desvincula los purchases que vinculamos para la demo
UPDATE bank_transactions SET linked_purchase_id = NULL, reviewed_by_user = false
WHERE id IN (12, 15) AND external_id LIKE 'seed_%';

-- Borra los 30 movimientos demo
DELETE FROM bank_transactions WHERE external_id LIKE 'seed_2026_%';

SELECT COUNT(*) FROM bank_transactions WHERE external_id LIKE 'seed_2026_%';
-- Debe devolver 0
```

Las 3 cuentas (Personal/Autónomo/Póliza) y las 16 reglas se quedan — son producción real.

---

## 📦 Lo que se entregó en esta sesión

**Commit fase 1:** `1023baf` (parser N43 + esquema base + frontend mínimo)
**Commit fase 2:** (siguiente) editor categoría inline + modal vincular + chips banco + resumen visual

**Archivos clave:**
- `app/src/components/BankList.tsx` — la vista
- `app/src/lib/api.ts` — helpers (suggestPurchases, linkTransactionToPurchase, listPurchaseIdsWithBankLink)
- `scripts/import_n43.py` — parser real listo para fichero de Ricard
- `scripts/test_import_n43.py` — 16 tests verde
- `supabase/migrations/012_bank_integration.sql` — migración aplicada en producción

**Plan completo:** `~/.claude/plans/wondrous-tumbling-firefly.md`
