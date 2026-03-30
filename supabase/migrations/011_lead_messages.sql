CREATE TABLE IF NOT EXISTS lead_messages (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  sender TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  source TEXT DEFAULT 'coches.net',
  gmail_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_messages_lead_id ON lead_messages(lead_id);
CREATE INDEX idx_lead_messages_gmail_id ON lead_messages(gmail_message_id);

ALTER TABLE lead_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company messages" ON lead_messages
  FOR ALL USING (company_id = 1);
