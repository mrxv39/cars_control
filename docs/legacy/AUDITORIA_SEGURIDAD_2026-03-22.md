# Auditoria de Seguridad - Cars Control

**Fecha:** 2026-03-22
**Alcance:** Revision de codigo fuente, configuracion y datos sensibles

---

## Hallazgos CRITICOS

### 1. Datos personales de clientes en repositorio Git

**Archivo:** `app/src-tauri/data/clients.json` (trackeado en git)

Contiene nombres reales y DNIs de clientes:
- BERNARDEZ CASAUS, MARGARITA - DNI: 46353187E
- GARATE GOMEZ, MARIA DEL MAR - DNI: 47.603.811-K

**Riesgo:** Violacion de GDPR/LOPD. Datos personales accesibles en historial de git.
**Accion tomada:** Archivo eliminado del tracking con `git rm --cached`. Anadido a .gitignore.
**Accion pendiente (manual):** Limpiar historial de git con `git filter-branch` o BFG Repo-Cleaner para eliminar datos del historial.

### 2. Clave Supabase hardcoded en codigo fuente

**Archivos afectados:**
- `app/src/lib/supabase.ts` - anon key como fallback
- `sync_leads_coches.py` - key hardcoded
- `insert_purchases.py` - key hardcoded
- `upload_docs.py` - key hardcoded

**Riesgo:** Cualquiera con acceso al repo puede acceder a la base de datos Supabase.
**Accion pendiente (manual):**
1. Rotar la anon key en el dashboard de Supabase
2. Eliminar fallbacks hardcoded, usar solo variables de entorno
3. Verificar que RLS (Row Level Security) esta activo en todas las tablas

### 3. Credenciales Gmail en .env

**Archivo:** `.env` contiene GMAIL_USER y GMAIL_APP_PASSWORD

**Estado actual:** `.env` esta en .gitignore (correcto), no esta commiteado.
**Riesgo:** Bajo siempre que no se commitee. El .env.* wildcard se ha anadido al .gitignore.
**Accion pendiente (manual):** Rotar el App Password de Gmail periodicamente.

---

## Hallazgos ALTOS

### 4. CSP deshabilitado en Tauri

**Archivo:** `app/src-tauri/tauri.conf.json`
```json
"security": { "csp": null }
```

**Riesgo:** Sin Content Security Policy, la app es vulnerable a inyeccion de scripts.
**Accion pendiente:** Configurar CSP restrictivo en proxima iteracion.

### 5. Salt de password hardcoded

**Archivos:**
- `app/src/lib/api.ts` - `codinacars_salt_{password}`
- `app/src-tauri/src/db.rs` - mismo patron

**Riesgo:** Salt visible en codigo debilita el hash. Deberia usar bcrypt con salt aleatorio.
**Accion pendiente:** Migrar a bcrypt en proxima iteracion de seguridad.

---

## Hallazgos MEDIOS

### 6. Repositorio posiblemente publico

**URL:** `https://github.com/mrxv39/cars_control.git`
**Accion pendiente (manual):** Verificar que el repositorio es PRIVADO en GitHub Settings.

### 7. Scripts Python con fallbacks de credenciales

Los scripts `sync_leads_coches.py`, `insert_purchases.py`, `upload_docs.py` usan `os.environ.get()` con valores por defecto que contienen la URL/key real. Si no se configura la variable de entorno, funcionan igualmente con las credenciales hardcoded.

---

## Acciones completadas en esta auditoria

| Accion | Estado |
|--------|--------|
| .gitignore: anadir data/, backups/, .env.*, *.log | HECHO |
| .gitignore: anadir clients.json y leads.json | HECHO |
| Eliminar clients.json del tracking git | HECHO |
| Verificar que .db no esta en git | OK (ya en .gitignore) |
| Verificar que .env no esta en git | OK (ya en .gitignore) |

## Acciones pendientes (requieren intervencion manual)

| Prioridad | Accion |
|-----------|--------|
| CRITICA | Limpiar DNIs del historial de git (BFG Repo-Cleaner) |
| CRITICA | Rotar Supabase anon key |
| CRITICA | Verificar que el repo GitHub es privado |
| ALTA | Eliminar fallbacks hardcoded de Supabase key en scripts Python |
| ALTA | Configurar CSP en tauri.conf.json |
| MEDIA | Migrar password hashing a bcrypt |
| BAJA | Crear .env.example con placeholders |
