# Guía para Ricard: Activar la importación automática de leads

Hola Ricard! Esta guía te explica paso a paso cómo configurar la
importación automática de leads desde coches.net. Cuando acabes,
los leads llegarán solos a la app cada 5 minutos, sin necesidad de
tener ningún ordenador encendido.

Tiempo estimado: 15-20 minutos. Solo hay que hacerlo una vez.

---

## PARTE 1: Crear las credenciales de Google (10 min)

Necesitamos que Google nos deje leer los emails de codinacars@gmail.com
desde el servidor. Para eso hay que crear unas "llaves" en Google Cloud.

### Paso 1.1 — Entrar en Google Cloud Console

1. Abre el navegador y ve a: https://console.cloud.google.com/
2. Inicia sesión con la cuenta **codinacars@gmail.com**
3. Si es la primera vez, acepta los términos de servicio

### Paso 1.2 — Crear un proyecto

1. Arriba a la izquierda, al lado del logo de Google Cloud, verás un desplegable
   con el nombre del proyecto (o "Select a project")
2. Haz clic ahí y luego en **"New Project"** (arriba a la derecha del popup)
3. Ponle de nombre: `CodinaCars`
4. Haz clic en **"Create"**
5. Espera unos segundos y asegúrate de que el proyecto "CodinaCars" está seleccionado
   en el desplegable de arriba

### Paso 1.3 — Activar la Gmail API

1. En el menú de la izquierda, ve a **"APIs & Services"** > **"Library"**
   (o busca "Library" en la barra de búsqueda de arriba)
2. En el buscador de la Library, escribe: **Gmail API**
3. Haz clic en el resultado **"Gmail API"** (el de Google)
4. Haz clic en el botón azul **"ENABLE"**
5. Espera a que se active (te redirigirá a la página de la API)

### Paso 1.4 — Configurar la pantalla de consentimiento

Antes de crear credenciales, Google pide configurar una pantalla de consentimiento:

1. En el menú de la izquierda, ve a **"APIs & Services"** > **"OAuth consent screen"**
2. Selecciona **"External"** y haz clic en **"Create"**
3. Rellena solo lo obligatorio:
   - **App name**: `CodinaCars Leads`
   - **User support email**: `codinacars@gmail.com`
   - **Developer contact email** (abajo del todo): `codinacars@gmail.com`
4. Haz clic en **"Save and Continue"**
5. En la pantalla de "Scopes", haz clic en **"Save and Continue"** (no toques nada)
6. En la pantalla de "Test users":
   - Haz clic en **"+ Add Users"**
   - Escribe: `codinacars@gmail.com`
   - Haz clic en **"Add"**
   - Haz clic en **"Save and Continue"**
7. Haz clic en **"Back to Dashboard"**

### Paso 1.5 — Crear las credenciales OAuth

1. En el menú de la izquierda, ve a **"APIs & Services"** > **"Credentials"**
2. Arriba, haz clic en **"+ CREATE CREDENTIALS"** > **"OAuth client ID"**
3. En "Application type", selecciona: **Desktop app**
4. En "Name", pon: `CodinaCars Leads Sync`
5. Haz clic en **"Create"**
6. Te aparecerá un popup con dos datos importantes. **APUNTA ESTOS DOS VALORES**:

   ```
   Client ID:     xxxxxxxx.apps.googleusercontent.com
   Client Secret: GOCSPx-xxxxxxxxxxxxxxxx
   ```

   (También puedes hacer clic en "Download JSON" para guardarlos)

7. Haz clic en **"OK"**

---

## PARTE 2: Obtener el Refresh Token (5 min)

Ahora necesitamos un "token" que permita acceder al email de forma permanente.

### Paso 2.1 — Abrir el OAuth Playground

1. Abre esta dirección en el navegador:
   https://developers.google.com/oauthplayground/

### Paso 2.2 — Configurar tus credenciales

1. Arriba a la derecha de la página, haz clic en el icono de **engranaje** (⚙️)
2. En el panel que se abre:
   - Marca la casilla **"Use your own OAuth credentials"**
   - En **"OAuth Client ID"**: pega el Client ID del paso 1.5
   - En **"OAuth Client secret"**: pega el Client Secret del paso 1.5
3. Cierra el panel del engranaje

### Paso 2.3 — Autorizar el acceso a Gmail

1. En la columna de la izquierda, busca y despliega **"Gmail API v1"**
2. Marca la casilla: `https://www.googleapis.com/auth/gmail.modify`
3. Haz clic en el botón azul **"Authorize APIs"**
4. Se abrirá una ventana de Google para iniciar sesión
5. Inicia sesión con **codinacars@gmail.com**
6. Te dirá que la app no está verificada. Haz clic en **"Continue"** (o "Avanzado" > "Ir a CodinaCars Leads")
7. Concede los permisos que pide y haz clic en **"Continue"**
8. Te redirigirá de vuelta al OAuth Playground

### Paso 2.4 — Obtener el Refresh Token

1. Ahora verás que estás en el "Step 2" del Playground
2. Haz clic en el botón **"Exchange authorization code for tokens"**
3. En el panel de la derecha aparecerá un JSON. Busca la línea que dice:

   ```
   "refresh_token": "1//0xxxxxxxxxxxxxxxxxx..."
   ```

4. **COPIA ese valor completo** del refresh_token (sin las comillas)
   Guárdalo en un sitio seguro, lo necesitarás en el siguiente paso.

---

## PARTE 3: Configurar Supabase (5 min)

### Paso 3.1 — Abrir el Dashboard de Supabase

1. Ve a: https://supabase.com/dashboard
2. Inicia sesión y entra en el proyecto de CodinaCars

### Paso 3.2 — Guardar los secrets

1. En el menú de la izquierda, ve a **"Edge Functions"**
   (si no lo ves, busca en "Project Settings" o en el icono de rayo ⚡)
2. Ve a **"Secrets"** (o desde Project Settings > Edge Functions > Secrets)
3. Haz clic en **"Add new secret"** y crea estos 3 secrets uno por uno:

   | Name                  | Value                                          |
   |-----------------------|------------------------------------------------|
   | `GMAIL_CLIENT_ID`     | El Client ID del paso 1.5                      |
   | `GMAIL_CLIENT_SECRET` | El Client Secret del paso 1.5                  |
   | `GMAIL_REFRESH_TOKEN` | El Refresh Token del paso 2.4                  |

### Paso 3.3 — Enviarme los datos para desplegar

Una vez tengas los 3 secrets configurados en Supabase, avísame y yo me
encargo de:

- Desplegar la función en el servidor
- Configurar el cron para que se ejecute cada 5 minutos
- Verificar que funciona
- Eliminar la tarea del ordenador local

---

## FAQ — Preguntas frecuentes

**P: ¿Esto cuesta dinero?**
R: No. Tanto Google Cloud (Gmail API) como Supabase Edge Functions tienen
   tier gratuito más que suficiente para este uso.

**P: ¿El refresh token caduca?**
R: No caduca mientras la app esté en modo "Testing" con menos de 100 usuarios
   y se use al menos cada 6 meses. Si algún día deja de funcionar, solo hay
   que repetir la Parte 2 para obtener uno nuevo.

**P: ¿Y si cambio la contraseña de Gmail?**
R: El refresh token seguirá funcionando. Solo se invalida si revocas el
   acceso manualmente desde la cuenta de Google.

**P: ¿Puedo ver si está funcionando?**
R: Sí. En el Dashboard de Supabase > Edge Functions > sync-leads puedes
   ver los logs de cada ejecución. También verás los leads nuevos
   apareciendo en la app automáticamente.

**P: ¿Cómo lo paro si hay algún problema?**
R: En Supabase Dashboard > SQL Editor, ejecuta:
   ```sql
   SELECT cron.unschedule('sync-leads-coches');
   ```
   Eso para el cron. La función sigue existiendo pero no se ejecutará
   hasta que la vuelvas a programar.
