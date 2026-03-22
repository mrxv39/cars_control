# Deploy: Sync Leads Edge Function

## Resumen

La función `sync-leads` se ejecuta cada 5 minutos en Supabase, lee los emails de coches.net via Gmail API, y crea leads automáticamente.

## Paso 1: Configurar Google Cloud OAuth2 (una sola vez)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto nuevo (o usa uno existente)
3. **Habilita la Gmail API**: APIs & Services > Library > busca "Gmail API" > Enable
4. **Crea credenciales OAuth2**:
   - APIs & Services > Credentials > Create Credentials > OAuth Client ID
   - Application type: **Desktop app**
   - Descarga el JSON con `client_id` y `client_secret`

5. **Obtener el Refresh Token**:
   - Ve a [OAuth Playground](https://developers.google.com/oauthplayground/)
   - Click en el engranaje (⚙️) arriba a la derecha
   - Marca "Use your own OAuth credentials"
   - Pega tu `client_id` y `client_secret`
   - En la lista de la izquierda, busca "Gmail API v1" y selecciona `https://www.googleapis.com/auth/gmail.modify`
   - Click "Authorize APIs" > Inicia sesión con **codinacars@gmail.com**
   - Click "Exchange authorization code for tokens"
   - Copia el **Refresh Token** que aparece

## Paso 2: Instalar Supabase CLI

```bash
npm install -g supabase
supabase login
```

## Paso 3: Configurar secrets en Supabase

```bash
cd C:\Users\Usuario\Desktop\proyectos\cars_control

supabase secrets set GMAIL_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
supabase secrets set GMAIL_CLIENT_SECRET="tu-client-secret"
supabase secrets set GMAIL_REFRESH_TOKEN="tu-refresh-token"
```

> SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya están disponibles automáticamente en Edge Functions.

## Paso 4: Desplegar la Edge Function

```bash
supabase link --project-ref hyydkyhvgcekvtkrnspf
supabase functions deploy sync-leads --no-verify-jwt
```

> `--no-verify-jwt` permite que pg_cron llame la función sin JWT de usuario.

## Paso 5: Probar manualmente

```bash
curl -X POST https://hyydkyhvgcekvtkrnspf.supabase.co/functions/v1/sync-leads \
  -H "Authorization: Bearer TU_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Deberías ver un JSON con `created` y `logs`.

## Paso 6: Configurar pg_cron (cada 5 minutos)

1. Ve al Dashboard de Supabase > **SQL Editor**
2. Copia y pega el contenido de `supabase/setup_cron.sql`
3. Ejecuta

> **Nota**: pg_cron usa `current_setting('app.settings.service_role_key')` que puede no estar configurado por defecto. Si el cron falla con error de auth, usa esta alternativa en el SQL:

```sql
SELECT cron.schedule(
  'sync-leads-coches',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hyydkyhvgcekvtkrnspf.supabase.co/functions/v1/sync-leads',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer TU_SERVICE_ROLE_KEY_AQUI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

## Paso 7: Eliminar la tarea local de Windows

Una vez verificado que funciona en el servidor:

```powershell
schtasks /delete /tn "SyncLeadsCoches" /f
```

## Monitorización

Ver si el cron se está ejecutando:

```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

Ver logs de la Edge Function:

```bash
supabase functions logs sync-leads
```
