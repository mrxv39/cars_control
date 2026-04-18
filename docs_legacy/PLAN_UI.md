# Plan de Mejoras UI — Cars Control Web

> **Para Claude Code**: ejecuta las tareas en orden dentro de cada fase.
> Cada tarea es un ciclo independiente con su propio commit.
> Sigue estrictamente las reglas de `CLAUDE.md`.
> **SOLO tocar la versión Web** (WebApp.tsx, App.css). Tauri es legacy.

---

## Diagnóstico actual

- **Inline styles**: 400+ estilos inline en WebApp.tsx — dificultan mantenimiento y consistencia
- **Variables CSS**: existen 15 colores en `:root` pero NO hay variables para spacing, border-radius, shadows ni tipografía
- **Tipografía**: 12+ tamaños de fuente distintos sin escala definida (0.76rem, 0.78rem, 0.82rem, 0.85rem, 0.88rem...)
- **Spacing**: padding/margin con valores arbitrarios (1.1rem, 1.4rem, 0.85rem, 0.65rem)
- **Border-radius**: 9 valores distintos (6px, 8px, 10px, 12px, 14px, 16px, 18px, 24px)
- **Sombras**: hardcoded en cada componente, sin escala
- **Formularios**: sin validación visual, sin feedback inline, gaps inconsistentes
- **Estados vacíos**: mensajes inconsistentes ("No hay...", "Sin...", "sin revisar")
- **Loading**: solo texto ("Cargando..."), sin spinner ni skeleton
- **Confirmaciones**: usa `confirm()` nativo del navegador (feo, no personalizable)
- **Tildes/acentos**: "Contrasena", "conexion", "Telefono", "Kilometros" — faltan acentos
- **Botones**: 4+ patrones de tamaño distintos con overrides inline
- **Responsive**: media queries duplicadas en 960px y 768px, sin breakpoint para <480px

---

## FASE 1: Design Tokens (fundamentos sin cambio visual)

### 1.1 — Escala de spacing y border-radius en CSS

**Scope**: `app/src/App.css` — solo `:root`
**Riesgo**: Bajo (solo añade variables, no cambia nada aún)

Añadir a `:root`:
```css
/* Spacing scale */
--space-xs: 0.25rem;    /* 4px */
--space-sm: 0.5rem;     /* 8px */
--space-md: 0.75rem;    /* 12px */
--space-lg: 1rem;       /* 16px */
--space-xl: 1.5rem;     /* 24px */
--space-2xl: 2rem;      /* 32px */
--space-3xl: 3rem;      /* 48px */

/* Border radius */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-xl: 20px;

/* Shadows */
--shadow-xs: 0 1px 3px rgba(0, 0, 0, 0.04);
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
--shadow-md: 0 8px 20px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.10);
--shadow-focus: 0 0 0 3px rgba(29, 78, 216, 0.25);

/* Transitions */
--transition-fast: 100ms ease;
--transition-normal: 150ms ease;
--transition-slow: 250ms ease;
```

No sustituir valores todavía — solo declarar variables.

**Commit**: `style(tokens): añadir variables CSS para spacing, radius, shadows y transitions`

---

### 1.2 — Escala tipográfica en CSS

**Scope**: `app/src/App.css` — solo `:root`
**Riesgo**: Bajo

Añadir a `:root`:
```css
/* Font sizes */
--text-xs: 0.75rem;     /* 12px - labels muy pequeños */
--text-sm: 0.85rem;     /* ~14px - labels, metadata */
--text-base: 0.95rem;   /* ~15px - cuerpo de texto */
--text-lg: 1.1rem;      /* ~18px - subtítulos */
--text-xl: 1.35rem;     /* ~22px - títulos de sección */
--text-2xl: 1.7rem;     /* ~27px - títulos de página */
--text-3xl: 2.2rem;     /* ~35px - hero títulos */

/* Font weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

**Commit**: `style(tokens): añadir escala tipográfica a variables CSS`

---

### 1.3 — Colores faltantes en variables

**Scope**: `app/src/App.css` — solo `:root`
**Riesgo**: Bajo

Añadir colores que están hardcoded por el CSS:
```css
/* Backgrounds adicionales */
--color-bg-error: #fef2f2;
--color-bg-success: #f0fdf4;
--color-bg-info: #eff6ff;
--color-bg-warning: #fffbeb;

/* Brand */
--color-sidebar-dark: #1a1a2e;
--color-sidebar-accent: #3b82f6;
--color-orange: #ff6b00;

/* Borders */
--color-border-light: rgba(0, 0, 0, 0.08);
--color-border-medium: rgba(0, 0, 0, 0.15);

/* Input */
--color-input-border: rgba(0, 0, 0, 0.12);
--color-input-focus: rgba(29, 78, 216, 0.3);
```

**Commit**: `style(tokens): completar paleta de colores en variables CSS`

---

## FASE 2: Migrar estilos inline a CSS (cambio visual mínimo)

### 2.1 — Crear clases utilitarias para patrones repetidos

**Scope**: `app/src/App.css`
**Riesgo**: Bajo (solo añade clases nuevas)

Crear clases CSS para los patrones inline más repetidos en WebApp.tsx:
```css
/* Layout utilities */
.flex-col { display: flex; flex-direction: column; }
.flex-row { display: flex; flex-direction: row; align-items: center; }
.flex-wrap { flex-wrap: wrap; }
.gap-sm { gap: var(--space-sm); }
.gap-md { gap: var(--space-md); }
.gap-lg { gap: var(--space-lg); }
.gap-xl { gap: var(--space-xl); }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }

/* Text */
.text-sm { font-size: var(--text-sm); }
.text-muted { color: var(--color-text-muted); }
.text-center { text-align: center; }
.text-error { color: var(--color-danger); }
.text-success { color: var(--color-success); }
.font-semibold { font-weight: var(--font-semibold); }

/* Spacing */
.p-lg { padding: var(--space-lg); }
.p-xl { padding: var(--space-xl); }
.mb-sm { margin-bottom: var(--space-sm); }
.mb-md { margin-bottom: var(--space-md); }
.mb-lg { margin-bottom: var(--space-lg); }
.w-full { width: 100%; }
```

No tocar WebApp.tsx todavía — solo preparar las clases.

**Commit**: `style(utils): crear clases utilitarias CSS para layout, texto y spacing`

---

### 2.2 — Migrar estilos inline de formularios a CSS

**Scope**: `app/src/App.css` + `app/src/WebApp.tsx`
**Riesgo**: Medio (toca WebApp.tsx pero solo reemplaza `style={}` por `className`)

Crear clases para los formularios y reemplazar estilos inline:

```css
/* Form layouts */
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
.form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-md); }
.form-stack { display: flex; flex-direction: column; gap: var(--space-md); }
.form-actions { display: flex; gap: var(--space-sm); justify-content: flex-end; margin-top: var(--space-lg); }

@media (max-width: 768px) {
  .form-grid-2, .form-grid-3 { grid-template-columns: 1fr; }
}
```

Buscar TODOS los `style={{ display: "grid", gridTemplateColumns: "1fr 1fr"` en WebApp.tsx y reemplazar por `className="form-grid-2"`. Lo mismo para `flex-direction: column` con gap → `className="form-stack"`.

**Verificación**: la UI debe verse exactamente igual.

**Commit**: `refactor(ui): migrar estilos inline de formularios a clases CSS`

---

### 2.3 — Migrar estilos inline de paneles y contenedores

**Scope**: `app/src/App.css` + `app/src/WebApp.tsx`
**Riesgo**: Medio

Crear clases para los contenedores repetidos:
```css
.page-container { max-width: 1200px; margin: 0 auto; padding: var(--space-xl); }
.page-container-narrow { max-width: 520px; margin: var(--space-3xl) auto; padding: 0 var(--space-lg); }
.page-container-medium { max-width: 800px; margin: 0 auto; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xl); flex-wrap: wrap; gap: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: var(--font-bold); margin: 0; }
.section-title { font-size: var(--text-xl); font-weight: var(--font-semibold); margin: 0 0 var(--space-lg); }
```

Reemplazar `style={{ maxWidth: 420, margin: "3rem auto" }}` y similares por las clases correspondientes.

**Commit**: `refactor(ui): migrar contenedores y headers a clases CSS`

---

### 2.4 — Migrar estilos inline de botones pequeños

**Scope**: `app/src/App.css` + `app/src/WebApp.tsx`
**Riesgo**: Medio

Los botones tienen overrides inline como `style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}`. Crear variantes:
```css
.button.xs { padding: 0.2rem 0.5rem; font-size: var(--text-xs); }
.button.sm { padding: 0.4rem 0.75rem; font-size: var(--text-sm); }
/* .button (base) ya tiene tamaño normal */
.button.lg { padding: 1rem 1.5rem; font-size: var(--text-lg); }
.button.full-width { width: 100%; }
```

Reemplazar TODOS los `style={{ padding: "...", fontSize: "..." }}` en botones de WebApp.tsx por la variante correspondiente.

**Commit**: `refactor(ui): crear variantes de tamaño para botones y eliminar inline styles`

---

## FASE 3: Mejoras visuales (cambios visibles, mejora percibida)

### 3.1 — Focus states en todos los elementos interactivos

**Scope**: `app/src/App.css`
**Riesgo**: Bajo (aditivo)

Actualmente los inputs tienen `outline: none` sin reemplazo. Añadir:
```css
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-focus);
  outline: none;
}

.button:focus-visible {
  box-shadow: var(--shadow-focus);
  outline: none;
}

.nav-item:focus-visible {
  box-shadow: var(--shadow-focus);
  outline: none;
  border-radius: var(--radius-md);
}
```

**Commit**: `fix(a11y): añadir focus-visible states a inputs, botones y navegación`

---

### 3.2 — Componente de diálogo de confirmación (reemplazar confirm())

**Scope**: crear `app/src/components/web/ConfirmDialog.tsx` + WebApp.tsx
**Riesgo**: Medio (reemplaza `confirm()` nativo en 8+ sitios)

Crear componente modal de confirmación que reemplace `if (!confirm(...)) return`:

```tsx
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;     // default "Eliminar"
  cancelLabel?: string;      // default "Cancelar"
  variant?: "danger" | "warning";  // default "danger"
  onConfirm: () => void;
  onCancel: () => void;
}
```

Diseño: modal con overlay blur, icono de advertencia, título, mensaje, dos botones (cancelar secundario + confirmar peligro).

Añadir CSS en App.css:
```css
.confirm-overlay { /* reutiliza patrón de .modal-overlay */ }
.confirm-card { max-width: 400px; padding: var(--space-xl); border-radius: var(--radius-xl); }
.confirm-icon { /* icono de advertencia rojo/naranja */ }
.confirm-title { font-size: var(--text-lg); font-weight: var(--font-bold); }
.confirm-message { font-size: var(--text-base); color: var(--color-text-muted); }
.confirm-actions { display: flex; gap: var(--space-sm); justify-content: flex-end; }
```

Reemplazar TODOS los `if (!confirm(...))` en WebApp.tsx por `<ConfirmDialog>`.

**Commit**: `feat(ui): componente ConfirmDialog para reemplazar confirm() nativo`

---

### 3.3 — Componente de estado vacío

**Scope**: crear `app/src/components/web/EmptyState.tsx` + WebApp.tsx
**Riesgo**: Bajo (aditivo, reemplaza textos dispersos)

```tsx
interface EmptyStateProps {
  icon?: string;        // emoji o icono
  title: string;        // "Sin leads"
  description?: string; // "Aún no hay leads para este vehículo"
  action?: { label: string; onClick: () => void };  // botón opcional
}
```

Diseño: centrado, icono grande arriba, título en `--text-lg`, descripción en `--text-sm --color-text-muted`, botón de acción opcional.

Reemplazar todos los mensajes vacíos dispersos:
- "Sin leads para este vehiculo" → `<EmptyState icon="📋" title="Sin leads" description="Este vehículo no tiene leads asociados" />`
- "Sin resultados" → `<EmptyState icon="🔍" title="Sin resultados" description="Prueba con otros términos de búsqueda" />`
- etc.

**Commit**: `feat(ui): componente EmptyState para estados vacíos consistentes`

---

### 3.4 — Componente spinner de carga

**Scope**: crear `app/src/components/web/Spinner.tsx` + App.css + WebApp.tsx
**Riesgo**: Bajo

Crear spinner CSS puro (no depende de librería):
```css
.spinner {
  width: 24px; height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
.spinner.lg { width: 40px; height: 40px; border-width: 4px; }

@keyframes spin { to { transform: rotate(360deg); } }

.loading-screen {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: var(--space-lg); padding: var(--space-3xl);
  color: var(--color-text-muted);
}
```

Reemplazar todos los "Cargando..." por `<div className="loading-screen"><div className="spinner lg" /><span>Cargando vehículos...</span></div>`.

**Commit**: `feat(ui): componente Spinner y pantalla de carga`

---

### 3.5 — Corregir tildes y acentos en toda la UI

**Scope**: `app/src/WebApp.tsx`
**Riesgo**: Bajo (solo texto)

Buscar y corregir TODOS los textos sin acentos:
- "Contrasena" → "Contraseña" (aparece 4+ veces)
- "conexion" → "conexión"
- "Telefono" → "Teléfono"
- "Kilometros" → "Kilómetros"
- "Direccion" → "Dirección"
- "vehiculo" → "vehículo" (donde sea label visible)
- "Numero" → "Número"
- "pagina" → "página"
- "informacion" → "información"
- "sesion" → "sesión"

Hacer grep global de palabras españolas sin acentos. Solo cambiar textos visibles al usuario (labels, placeholders, mensajes).

**Commit**: `fix(i18n): corregir acentos y tildes en textos de la UI`

---

### 3.6 — Mejorar feedback visual de formularios

**Scope**: `app/src/App.css` + `app/src/WebApp.tsx`
**Riesgo**: Medio

Añadir:

1. **Asterisco en campos obligatorios**:
```css
.field-label.required::after {
  content: " *";
  color: var(--color-danger);
}
```

2. **Toast de éxito/error** (reemplazar banners estáticos):
```css
.toast {
  position: fixed; bottom: var(--space-xl); right: var(--space-xl);
  padding: var(--space-md) var(--space-xl);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm); font-weight: var(--font-semibold);
  box-shadow: var(--shadow-lg);
  animation: toast-in 0.3s ease;
  z-index: 200;
}
.toast.success { background: var(--color-success); color: white; }
.toast.error { background: var(--color-danger); color: white; }

@keyframes toast-in {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

3. **Input con error**:
```css
.input-error {
  border-color: var(--color-danger) !important;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
}
```

**Commit**: `feat(ui): feedback visual mejorado — campos requeridos, toasts, inputs con error`

---

## FASE 4: Pulido visual (aspecto profesional)

### 4.1 — Unificar border-radius en toda la app

**Scope**: `app/src/App.css`
**Riesgo**: Bajo-Medio (cambio visual sutil)

Reemplazar TODOS los border-radius hardcoded por las 4 variables:
- `6px` → `var(--radius-sm)` — badges, tags pequeños
- `8px`, `10px`, `12px` → `var(--radius-md)` — inputs, botones, search bars
- `14px`, `16px` → `var(--radius-lg)` — cards, modals, paneles
- `18px`, `24px` → `var(--radius-xl)` — paneles principales, cards grandes

**Commit**: `style(ui): unificar border-radius con escala de 4 valores`

---

### 4.2 — Unificar sombras

**Scope**: `app/src/App.css`
**Riesgo**: Bajo (cambio visual sutil)

Reemplazar todos los `box-shadow` hardcoded:
- Sombras sutiles → `var(--shadow-xs)` o `var(--shadow-sm)`
- Sombras de card → `var(--shadow-md)`
- Sombras de hover / elevación → `var(--shadow-lg)`
- Sombras de focus → `var(--shadow-focus)`

**Commit**: `style(ui): unificar sombras con escala de 5 niveles`

---

### 4.3 — Estandarizar tipografía en componentes

**Scope**: `app/src/App.css`
**Riesgo**: Bajo-Medio (cambio visual sutil)

Reemplazar todos los `font-size` hardcoded:
- `0.75rem`, `0.76rem`, `0.78rem` → `var(--text-xs)`
- `0.82rem`, `0.85rem`, `0.88rem` → `var(--text-sm)`
- `0.9rem`, `0.92rem`, `0.95rem` → `var(--text-base)`
- `1.05rem`, `1.1rem` → `var(--text-lg)`
- `1.25rem`, `1.35rem` → `var(--text-xl)`
- `1.6rem`, `1.7rem` → `var(--text-2xl)`

**Commit**: `style(ui): estandarizar font-sizes con escala tipográfica`

---

### 4.4 — Limpiar media queries duplicadas

**Scope**: `app/src/App.css`
**Riesgo**: Medio

Actualmente hay media queries en `960px`, `768px`, `720px`, `600px` con reglas duplicadas. Consolidar:

- **≤960px**: reducir sidebar, ajustar grid de 3 col → 2 col
- **≤768px**: sidebar como drawer, grids a 1 col, padding reducido
- **≤480px** (NUEVO): ajustes para móviles pequeños (iPhone SE)

Eliminar reglas duplicadas entre breakpoints. Asegurar que no hay conflictos.

**Commit**: `fix(responsive): consolidar media queries y añadir breakpoint 480px`

---

### 4.5 — Mejorar sidebar y navegación

**Scope**: `app/src/App.css` + `app/src/WebApp.tsx`
**Riesgo**: Medio

Mejoras:
1. **Icono hamburguesa**: reemplazar ☰/✕ por SVG inline (3 líneas → X animado)
2. **Indicador de vista actual**: añadir borde izquierdo o fondo más visible en el nav-item activo
3. **Transición del menú móvil**: slide-in desde la izquierda con transición suave (transform + transition)
4. **Separadores visuales**: línea sutil entre secciones del menú (gestión, datos, herramientas)

```css
.sidebar { transition: transform var(--transition-slow); }
.nav-item.active {
  background: rgba(255, 255, 255, 0.15);
  border-left: 3px solid white;
}
```

**Commit**: `feat(ui): mejorar sidebar — iconos SVG, indicador activo, transiciones`

---

## FASE 5: UX avanzado

### 5.1 — Validación inline en formularios

**Scope**: `app/src/WebApp.tsx`
**Riesgo**: Medio

Añadir validación en tiempo real a los formularios principales:
- Login: "Contraseña obligatoria" bajo el campo si está vacío al hacer blur
- Crear vehículo: "Marca y modelo obligatorio"
- Crear lead: "Nombre obligatorio", "Teléfono o email obligatorio"
- Crear proveedor: "Nombre obligatorio"

Patrón: useState para errores por campo, validar en onBlur, mostrar mensaje bajo el input con clase `.input-error-message`:
```css
.input-error-message {
  font-size: var(--text-xs);
  color: var(--color-danger);
  margin-top: var(--space-xs);
}
```

**Commit**: `feat(ux): validación inline en formularios principales`

---

### 5.2 — Mejorar vista de detalle de vehículo

**Scope**: `app/src/WebApp.tsx`
**Riesgo**: Medio

La vista de detalle tiene 3 layouts (A/B/C) pero puede mejorar:
1. **Breadcrumb**: añadir "Stock › Peugeot 208" arriba para contexto de navegación
2. **Foto principal más grande**: hero image destacada con thumbnails debajo
3. **Indicador de margen**: badge visual que muestre "Margen: +2.500€" o "Sin precio de venta"
4. **Leads relacionados**: mostrar contador en badge "3 leads" junto al nombre del vehículo

**Commit**: `feat(ux): mejorar detalle de vehículo — breadcrumb, hero foto, indicador margen`

---

### 5.3 — Mejorar vista de leads con colores por estado

**Scope**: `app/src/WebApp.tsx` + `app/src/App.css`
**Riesgo**: Bajo (visual, aditivo)

Añadir indicador visual de color en cada lead según estado:
```css
.lead-status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.lead-status-dot.nuevo { background: var(--color-primary); }
.lead-status-dot.contactado { background: var(--color-warning); }
.lead-status-dot.negociando { background: var(--color-orange); }
.lead-status-dot.cerrado { background: var(--color-success); }
.lead-status-dot.perdido { background: var(--color-danger); }
.lead-status-dot.descartado { background: var(--color-text-muted); }
```

Cada card de lead muestra el dot de color a la izquierda del nombre para identificar el estado de un vistazo.

**Commit**: `feat(ui): indicadores de color por estado en leads`

---

### 5.4 — Mejorar accesibilidad general

**Scope**: `app/src/WebApp.tsx`
**Riesgo**: Bajo

- `aria-label` en todos los botones de icono (editar, eliminar, cerrar, hamburguesa)
- `role="alert"` en mensajes de error y toast
- `role="status"` en contadores del dashboard
- `aria-live="polite"` en listas que se recargan
- `alt` descriptivo en todas las `<img>` de vehículos (usar nombre del vehículo)
- Tab order lógico: sidebar → búsqueda → contenido principal

**Commit**: `fix(a11y): mejorar accesibilidad — aria labels, roles, alt text`

---

## Orden de ejecución

```
FASE 1 (tokens)       → 1.1 → 1.2 → 1.3
FASE 2 (migración)    → 2.1 → 2.2 → 2.3 → 2.4
FASE 3 (visual)       → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6
FASE 4 (pulido)       → 4.1 → 4.2 → 4.3 → 4.4 → 4.5
FASE 5 (UX avanzado)  → 5.1 → 5.2 → 5.3 → 5.4
```

Las fases son secuenciales: FASE 1 crea las variables que usan FASE 2-5. Dentro de cada fase, el orden importa.

---

## Reglas para Claude Code

1. **Antes de cada tarea**: ejecutar `npm test` y anotar baseline
2. **Después de cada tarea**: ejecutar `npm test` + `npx tsc --noEmit --skipLibCheck`
3. **Commit por tarea**: un commit limpio con formato `tipo(scope): descripción`
4. **Branch**: crear rama `ui/mejoras-fase-X` por cada fase
5. **Si algo falla**: `git stash`, anotar el problema, pasar a la siguiente tarea
6. **Verificación visual**: después de cada cambio CSS, confirmar que no hay cambios visuales inesperados (para fases 1-2) o que el cambio es el deseado (fases 3-5)
7. **NO TOCAR**: lógica de negocio, funciones de api.ts, flujos de auth, datos
8. **SOLO WEB**: no tocar App.tsx ni componentes Tauri-only
9. **Deploy**: NO hacer deploy automático
