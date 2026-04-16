-- Add company_id to feedback table for multi-tenant filtering.
-- Existing rows get company_id = 1 (CodinaCars, the only company).
-- The INSERT policy stays open (anyone can submit feedback), but now
-- includes company_id so we know which company the feedback came from.

ALTER TABLE feedback ADD COLUMN company_id bigint REFERENCES companies(id);
UPDATE feedback SET company_id = 1;

-- Update RLS: INSERT stays open but SELECT now filters by company
DROP POLICY IF EXISTS "anyone_insert_feedback" ON feedback;
DROP POLICY IF EXISTS "authenticated_read_feedback" ON feedback;

CREATE POLICY "anyone_insert_feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "own_company_read_feedback" ON feedback FOR SELECT
  USING (company_id = get_user_company_id() OR is_super_admin());
