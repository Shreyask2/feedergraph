-- GitHub OAuth identities + auto-created startup entities.

-- Unknown companies from github_verified submissions are auto-created with tier 'startup'.
ALTER TABLE canonical_entities DROP CONSTRAINT canonical_entities_tier_check;
ALTER TABLE canonical_entities ADD CONSTRAINT canonical_entities_tier_check
  CHECK (tier IN ('neolab','quant','big_tech','fintech','standard','startup'));

-- Numeric GitHub id taken server-side from the Supabase OAuth session (never client input).
-- The pipeline only grants github_verified when this id matches the GitHub account.
ALTER TABLE submissions ADD COLUMN github_user_id BIGINT;

-- Max 1 OAuth submission per GitHub user per season. Also serves the API's lookup.
CREATE UNIQUE INDEX submissions_github_season_uniq
  ON submissions (github_user_id, internship_season)
  WHERE github_user_id IS NOT NULL;
