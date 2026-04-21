-- 019_add_bank_categories.sql
--
-- Añade 6 categorías nuevas al catálogo de categorización bancaria:
--   PARKING         — aparcamientos (APARCAMIENTO, BARNAPARKING, BSM, PARKING…)
--   FORMACION       — cursos y formación
--   LIMPIEZA        — lavados de coche (IMO AUTO LAVADOS, etc.)
--   POLIZA_CAIXA    — cuotas póliza MyBox CaixaBank (REBUT UNIC MYBOX…)
--   PINTURA         — trabajos de pintura (separado de REPARACION)
--   ALQUILER_LOCAL  — alquiler del local comercial
--
-- Detectados al auditar movimientos SIN_CATEGORIZAR (2026-04-22):
--   - 19 cuotas MYBOX (póliza CaixaBank) sin categorizar
--   - 13 movimientos de parking
--   - 11 lavados de coche (IMO AUTO LAVADOS)
--
-- Cambios:
--   1) Rule 10 (REPARACION): quita "pintura" del patrón para que no ensombrezca
--      a la nueva regla PINTURA.
--   2) Inserta 6 reglas nuevas.
--   3) Re-categoriza filas SIN_CATEGORIZAR que coinciden con los nuevos patterns.
--
-- Idempotente: las reglas usan WHERE NOT EXISTS por category, y el UPDATE
-- final solo toca filas SIN_CATEGORIZAR (no pisa categorizaciones manuales).
-- Usa \y (word boundary POSIX de Postgres) en vez de \b.

BEGIN;

-- 1) Quitar "pintura" de la regla REPARACION para no colisionar con PINTURA
UPDATE bank_category_rules
SET pattern = '(?i)taller|chapa|mec[áa]nic'
WHERE id = 10 AND category = 'REPARACION';

-- 2) Insertar las 6 reglas nuevas (idempotente por category)
INSERT INTO bank_category_rules (company_id, pattern, category, priority, active)
SELECT 1, '(?i)\yparking\y|aparcamiento|barnaparking|\ybsm\y|\ysaba\y|empark|interparking', 'PARKING', 40, true
WHERE NOT EXISTS (SELECT 1 FROM bank_category_rules WHERE category = 'PARKING');

INSERT INTO bank_category_rules (company_id, pattern, category, priority, active)
SELECT 1, '(?i)formaci[oó]n|\ycurso\y|udemy|coursera', 'FORMACION', 40, true
WHERE NOT EXISTS (SELECT 1 FROM bank_category_rules WHERE category = 'FORMACION');

INSERT INTO bank_category_rules (company_id, pattern, category, priority, active)
SELECT 1, '(?i)auto\s*lavado|car\s*wash|\ylimpieza\y|imo auto|karcher', 'LIMPIEZA', 40, true
WHERE NOT EXISTS (SELECT 1 FROM bank_category_rules WHERE category = 'LIMPIEZA');

INSERT INTO bank_category_rules (company_id, pattern, category, priority, active)
SELECT 1, '(?i)mybox|rebut unic mybox', 'POLIZA_CAIXA', 25, true
WHERE NOT EXISTS (SELECT 1 FROM bank_category_rules WHERE category = 'POLIZA_CAIXA');

INSERT INTO bank_category_rules (company_id, pattern, category, priority, active)
SELECT 1, '(?i)\ypintura\y', 'PINTURA', 35, true
WHERE NOT EXISTS (SELECT 1 FROM bank_category_rules WHERE category = 'PINTURA');

INSERT INTO bank_category_rules (company_id, pattern, category, priority, active)
SELECT 1, '(?i)alquiler\s+local|lloguer\s+local|arrendamiento\s+local', 'ALQUILER_LOCAL', 40, true
WHERE NOT EXISTS (SELECT 1 FROM bank_category_rules WHERE category = 'ALQUILER_LOCAL');

-- 3) Re-categorizar filas SIN_CATEGORIZAR que coincidan con los nuevos patrones.
UPDATE bank_transactions
SET category = 'POLIZA_CAIXA'
WHERE category = 'SIN_CATEGORIZAR' AND description ~* 'mybox|rebut unic mybox';

UPDATE bank_transactions
SET category = 'PARKING'
WHERE category = 'SIN_CATEGORIZAR'
  AND description ~* '\yparking\y|aparcamiento|barnaparking|\ybsm\y|\ysaba\y|empark|interparking';

UPDATE bank_transactions
SET category = 'LIMPIEZA'
WHERE category = 'SIN_CATEGORIZAR'
  AND description ~* 'auto\s*lavado|car\s*wash|\ylimpieza\y|imo auto|karcher';

UPDATE bank_transactions
SET category = 'FORMACION'
WHERE category = 'SIN_CATEGORIZAR'
  AND description ~* 'formaci[oó]n|\ycurso\y|udemy|coursera';

UPDATE bank_transactions
SET category = 'PINTURA'
WHERE category = 'SIN_CATEGORIZAR' AND description ~* '\ypintura\y';

UPDATE bank_transactions
SET category = 'ALQUILER_LOCAL'
WHERE category = 'SIN_CATEGORIZAR'
  AND description ~* 'alquiler\s+local|lloguer\s+local|arrendamiento\s+local';

COMMIT;
