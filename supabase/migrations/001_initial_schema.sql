-- FeederGraph initial schema. Writes happen only via the service role (bypasses RLS).

CREATE TABLE canonical_entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company','oss_org','research_lab')),
  tier        TEXT NOT NULL DEFAULT 'standard'
              CHECK (tier IN ('neolab','quant','big_tech','fintech','standard')),
  logo_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE entity_aliases (
  alias        TEXT PRIMARY KEY CHECK (alias = lower(btrim(alias)) AND alias <> ''),
  entity_id    UUID NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  match_method TEXT NOT NULL CHECK (match_method IN ('seed','exact','fuzzy','admin')),
  confidence   NUMERIC(4,3) DEFAULT 1.000 CHECK (confidence BETWEEN 0 AND 1),
  is_verified  BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_company_raw    TEXT NOT NULL,
  target_entity_id      UUID REFERENCES canonical_entities(id),
  role_category         TEXT NOT NULL
                        CHECK (role_category IN ('SWE','MLE_AI','Quant','PM','Data','Security','Other')),
  internship_season     TEXT NOT NULL,
  prior_experiences_raw TEXT[] DEFAULT '{}',
  prior_entity_ids      UUID[] DEFAULT '{}',
  channel               TEXT NOT NULL
                        CHECK (channel IN ('cold_apply','referral','return_intern','recruiter_outreach','hackathon_oss')),
  github_username       TEXT,
  github_oss_score      INTEGER DEFAULT 0 CHECK (github_oss_score BETWEEN 0 AND 100),
  received_return_offer BOOLEAN, -- NULL while season is ongoing
  verification_tier     TEXT NOT NULL DEFAULT 'unverified'
                        CHECK (verification_tier IN ('unverified','github_verified')),
  trust_weight          NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (trust_weight BETWEEN 0 AND 1),
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','resolved','flagged','rejected')),
  flag_reason           TEXT,
  ip_hash               TEXT, -- salted SHA-256 only, never a raw IP
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE feeder_edges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE,
  role_category    TEXT NOT NULL,
  raw_count        INTEGER NOT NULL DEFAULT 1,
  verified_count   INTEGER NOT NULL DEFAULT 0,
  weighted_score   NUMERIC(8,2) NOT NULL DEFAULT 0,
  ro_yes_count     INTEGER NOT NULL DEFAULT 0,
  ro_known_total   INTEGER NOT NULL DEFAULT 0,
  bayesian_ro_rate NUMERIC(5,4),
  confidence_level TEXT NOT NULL DEFAULT 'low' CHECK (confidence_level IN ('low','medium','high')),
  top_channel      TEXT,
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source_entity_id, target_entity_id, role_category),
  CHECK (source_entity_id <> target_entity_id),
  CHECK (verified_count <= raw_count),
  CHECK (ro_yes_count <= ro_known_total AND ro_known_total <= raw_count)
);

-- Indexes: FKs and lookup columns. The UNIQUE constraint already covers source_entity_id prefix,
-- but the plan asks for it explicitly.
CREATE INDEX feeder_edges_target_idx    ON feeder_edges (target_entity_id);
CREATE INDEX feeder_edges_source_idx    ON feeder_edges (source_entity_id);
CREATE INDEX submissions_status_idx     ON submissions (status);
CREATE INDEX submissions_target_idx     ON submissions (target_entity_id);
CREATE INDEX submissions_ip_created_idx ON submissions (ip_hash, created_at); -- rate limit lookup
CREATE INDEX entity_aliases_entity_idx  ON entity_aliases (entity_id);

-- RLS: public read on graph data only. No policies on the others = deny all except service role.
ALTER TABLE canonical_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_aliases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeder_edges       ENABLE ROW LEVEL SECURITY;

CREATE POLICY canonical_entities_public_read ON canonical_entities
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY feeder_edges_public_read ON feeder_edges
  FOR SELECT TO anon, authenticated USING (true);
