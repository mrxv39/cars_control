CREATE TABLE feedback (
    id BIGSERIAL PRIMARY KEY,
    user_name TEXT,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    page TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_insert_feedback
    ON feedback FOR INSERT
    WITH CHECK (true);

CREATE POLICY allow_select_feedback_service
    ON feedback FOR SELECT
    USING (true);
