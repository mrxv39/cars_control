-- Columna para guardar la dirección de reenvío de coches.net (UUID@contactos.coches.net).
-- Contestar a este email propaga la respuesta al chat de coches.net automáticamente.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reply_to_email TEXT;

COMMENT ON COLUMN leads.reply_to_email IS
  'Destino al que contestar (ej: <uuid>@contactos.coches.net). Coches.net reenvía esa respuesta al chat del portal.';
