-- 013_fix_category_rules.sql
--
-- Fix de 3 reglas de categorización de la migration 012 detectados al importar
-- los primeros ~2.600 movimientos reales de CaixaBank (sesión 2026-04-11):
--
--   1) Rule 1 (COMPRA_VEHICULO): el patrón buscaba "auto1" literal pero el
--      concepto que imprime CaixaBank en las transferencias a Auto 1 lleva
--      espacio: "TRF.INTERNACIONAL | 00046 / AUTO 1". Sin el fix, los 33
--      pagos al proveedor alemán (~201k€ históricos) quedaban sin categoría.
--      Consecuencia fiscal: se perdía la traza del modelo 349 (compras
--      intracomunitarias).
--
--   2) Rule 4 (IMPUESTO_130): el patrón `mod[. ]?130` solo permitía 1 char
--      entre "MOD" y "130", pero el concepto real es "I.R.P.F. MOD. 130"
--      con punto Y espacio. Sin el fix, las 6 declaraciones trimestrales
--      del IRPF autónomo quedaban sin categorizar (-9.853€ históricos).
--
--   3) Rule 15 (TRASPASO_INTERNO): solo matcheaba "traspaso" en castellano,
--      pero CaixaBank Banca Premier mezcla catalán y castellano — aparecen
--      como "TRASPÀS PROPI", "Traspàs Propi", "TRASPAS" y "Traspas Propi"
--      además de "traspaso propio". Sin el fix, solo 36 de 204 traspasos
--      internos se categorizaban.
--
-- El fix es idempotente: actualiza patterns por id. No modifica prioridad
-- ni categoría destino. Las filas ya en BD se re-categorizaron a mano
-- tras aplicar este fix en caliente (UPDATE bank_transactions WHERE
-- category='SIN_CATEGORIZAR' AND description ~* <nuevo patrón>).

BEGIN;

UPDATE bank_category_rules
SET pattern = '(?i)auto\s*1|carauction|bca europe'
WHERE id = 1 AND category = 'COMPRA_VEHICULO';

UPDATE bank_category_rules
SET pattern = '(?i)mod[\.\s]+130|agencia tributaria.*130'
WHERE id = 4 AND category = 'IMPUESTO_130';

UPDATE bank_category_rules
SET pattern = '(?i)traspaso|trasp[àa]s|transferencia interna'
WHERE id = 15 AND category = 'TRASPASO_INTERNO';

-- Sanity check: verificar que las 3 filas se actualizaron
DO $$
DECLARE
    n integer;
BEGIN
    SELECT count(*) INTO n
    FROM bank_category_rules
    WHERE id IN (1, 4, 15)
      AND pattern LIKE '(?i)%';
    IF n <> 3 THEN
        RAISE EXCEPTION 'Expected 3 updated rules, got %', n;
    END IF;
END$$;

COMMIT;
