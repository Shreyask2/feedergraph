-- In-app user feedback. RLS on with no policies: only the service role (API routes) can read/write.
CREATE TABLE feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT NOT NULL CHECK (category IN ('bug','missing_company','feature','other')),
  message      TEXT NOT NULL CHECK (char_length(message) BETWEEN 5 AND 1000),
  page_context TEXT,
  ip_hash      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX feedback_ip_hash_created_idx ON feedback (ip_hash, created_at);
CREATE INDEX feedback_created_idx ON feedback (created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
