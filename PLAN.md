# PLAN.md — FeederGraph (Tech Internship Hiring Graph)
## 1. Context & Product Goal
FeederGraph is a reverse-engineered hiring graph for tech internships built for Sudomarith's Direct Consideration community (zero2sudo). It crowdsources student internship paths, verifies open-source impact via GitHub, resolves messy company names into canonical nodes, and calculates statistically smoothed return-offer rates.
### Core Questions Answered
1. Where do interns at Company X actually come from? (Prior internships, OSS orgs, referral vs. cold apply rates).
2. Which internships actually convert to full-time return offers? (Smoothed RO rate + sample-size confidence).
## 2. Tech Stack & Claude Guardrails
* **Frontend:** Next.js 15+ (App Router, TypeScript strict), Tailwind CSS, `shadcn/ui` (init in Phase 3), `@xyflow/react` (desktop graph), mobile-first ranked list view.
* **Database:** Supabase (PostgreSQL with Row Level Security).
* **Data Pipeline:** Python 3.11+, `rapidfuzz` (fuzzy string resolution), `httpx` (GitHub REST API), `psycopg[binary]`, `pytest`.
* **Execution Rules:**
  * Follow `karpathy-guidelines`: minimal surgical diffs, no premature abstractions, verify assumptions before coding.
  * Follow `supabase-postgres-best-practices`: index foreign keys/lookup columns, parameterized SQL, strict RLS.
  * Follow `frontend-design`: high-contrast, data-dense analytics UI (not generic SaaS boilerplate).
  * Query **Context7 MCP** before writing `@xyflow/react`, `shadcn/ui`, or Next.js App Router code.
## 3. Exact Repository Structure
* `feeder-graph/PLAN.md`
* `feeder-graph/CLAUDE.md`
* `feeder-graph/supabase/migrations/001_initial_schema.sql`
* `feeder-graph/supabase/seed.sql`
* `feeder-graph/pipeline/pyproject.toml`
* `feeder-graph/pipeline/data/seed_aliases.json` (100+ tech acronyms/aliases: `aws`->`Amazon`, `capone`->`Capital One`, `fair`->`Meta`, `gdm`->`Google DeepMind`, etc.)
* `feeder-graph/pipeline/src/config.py`
* `feeder-graph/pipeline/src/resolver.py` (Normalization + Exact Alias + RapidFuzz matcher)
* `feeder-graph/pipeline/src/github_enricher.py` (GitHub REST API repo stars, external PRs, OSS score)
* `feeder-graph/pipeline/src/bayesian.py` (Bayesian smoothed RO rate + confidence tier)
* `feeder-graph/pipeline/src/run_pipeline.py` (Processes pending submissions & upserts `feeder_edges`)
* `feeder-graph/pipeline/tests/test_resolver.py`
* `feeder-graph/pipeline/tests/test_bayesian.py`
* `feeder-graph/pipeline/tests/test_github_enricher.py`
* `feeder-graph/frontend/src/app/page.tsx` (Explorer: Mobile ranked list + Desktop `@xyflow/react` graph toggle)
* `feeder-graph/frontend/src/app/submit/page.tsx` (Crowdsourced submission form)
* `feeder-graph/frontend/src/app/admin/page.tsx` (Protected moderation queue for flagged aliases)
* `feeder-graph/frontend/src/app/api/graph/route.ts` (GET filtered nodes & weighted edges for a target company)
* `feeder-graph/frontend/src/app/api/submit/route.ts` (POST Zod-validated submission + IP-hash rate limit)
* `feeder-graph/frontend/src/app/api/admin/resolve/route.ts` (POST approve/merge alias into `entity_aliases`)
* `feeder-graph/frontend/src/components/graph/HiringGraph.tsx` (`@xyflow/react` canvas + custom nodes/edges)
* `feeder-graph/frontend/src/components/graph/MobileFeederList.tsx` (Responsive ranked feeder bars for mobile/IG traffic)
* `feeder-graph/frontend/src/components/graph/CompanyInspector.tsx` (Side drawer: RO confidence badge, channel breakdown)
* `feeder-graph/frontend/src/components/graph/GraphControls.tsx` (Company search, Role filter, Verified-Only toggle)
* `feeder-graph/frontend/src/components/forms/SubmissionForm.tsx`
* `feeder-graph/frontend/src/lib/supabase/` & `frontend/src/lib/types.ts`
## 4. Exact PostgreSQL Schema (`supabase/migrations/001_initial_schema.sql`)
* **Table `canonical_entities`:** `id UUID PK DEFAULT gen_random_uuid()`, `name TEXT UNIQUE NOT NULL`, `slug TEXT UNIQUE NOT NULL`, `entity_type TEXT NOT NULL CHECK (entity_type IN ('company','oss_org','research_lab'))`, `tier TEXT NOT NULL DEFAULT 'standard'` (`'neolab'`, `'quant'`, `'big_tech'`, `'fintech'`, `'standard'`), `logo_url TEXT`, `created_at TIMESTAMPTZ DEFAULT now()`.
* **Table `entity_aliases`:** `alias TEXT PK` (lowercase trimmed string), `entity_id UUID NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE`, `match_method TEXT NOT NULL CHECK (match_method IN ('seed','exact','fuzzy','admin'))`, `confidence NUMERIC(4,3) DEFAULT 1.000`, `is_verified BOOLEAN DEFAULT false`, `created_at TIMESTAMPTZ DEFAULT now()`.
* **Table `submissions`:** `id UUID PK DEFAULT gen_random_uuid()`, `target_company_raw TEXT NOT NULL`, `target_entity_id UUID REFERENCES canonical_entities(id)`, `role_category TEXT NOT NULL CHECK (role_category IN ('SWE','MLE_AI','Quant','PM','Data','Security','Other'))`, `internship_season TEXT NOT NULL`, `prior_experiences_raw TEXT[] DEFAULT '{}'`, `prior_entity_ids UUID[] DEFAULT '{}'`, `channel TEXT NOT NULL CHECK (channel IN ('cold_apply','referral','return_intern','recruiter_outreach','hackathon_oss'))`, `github_username TEXT`, `github_oss_score INTEGER DEFAULT 0`, `received_return_offer BOOLEAN` (NULL if season ongoing), `verification_tier TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_tier IN ('unverified','github_verified'))`, `trust_weight NUMERIC(3,2) NOT NULL DEFAULT 0.50` (`0.50` unverified, `1.00` github_verified), `status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','flagged','rejected'))`, `flag_reason TEXT`, `ip_hash TEXT`, `created_at TIMESTAMPTZ DEFAULT now()`.
* **Table `feeder_edges`:** `id UUID PK DEFAULT gen_random_uuid()`, `source_entity_id UUID NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE`, `target_entity_id UUID NOT NULL REFERENCES canonical_entities(id) ON DELETE CASCADE`, `role_category TEXT NOT NULL`, `raw_count INTEGER NOT NULL DEFAULT 1`, `verified_count INTEGER NOT NULL DEFAULT 0`, `weighted_score NUMERIC(8,2) NOT NULL DEFAULT 0`, `ro_yes_count INTEGER NOT NULL DEFAULT 0`, `ro_known_total INTEGER NOT NULL DEFAULT 0`, `bayesian_ro_rate NUMERIC(5,4)`, `confidence_level TEXT NOT NULL DEFAULT 'low' CHECK (confidence_level IN ('low','medium','high'))`, `top_channel TEXT`, `updated_at TIMESTAMPTZ DEFAULT now()`, `UNIQUE (source_entity_id, target_entity_id, role_category)`.
* **Indexes & RLS:** B-tree indexes on `feeder_edges(target_entity_id)`, `feeder_edges(source_entity_id)`, and `submissions(status)`. Enable RLS on all 4 tables; allow public `SELECT` on `canonical_entities` and `feeder_edges` only; restrict all writes and `submissions`/`entity_aliases` reads to server service role.
## 5. Exact Pipeline Algorithms & Formulas (`pipeline/`)
* **String Normalization (`resolver.py`):** Lowercase, strip whitespace, remove punctuation, strip corporate suffixes (`inc`, `llc`, `corp`, `technologies`, `financial`, `labs`, `platforms`).
* **2-Stage Resolution (`resolver.py`):**
  1. Check `entity_aliases` (seeded with 100+ acronyms/nicknames from `seed_aliases.json`) for exact `O(1)` match (`confidence = 1.0`).
  2. Run `rapidfuzz.process.extractOne` with `fuzz.token_sort_ratio` against canonical names + verified aliases: `score >= 90` auto-resolves & saves alias (`is_verified = false`); `78 <= score < 90` flags submission (`status = 'flagged'`, `flag_reason = 'ambiguous_fuzzy_match'`); `score < 78` flags as `'new_entity_candidate'` for `/admin` approval.
* **GitHub Enricher (`github_enricher.py`):** If `github_username` is provided, query `GET https://api.github.com/users/{username}/repos?per_page=100`. If user exists with `>= 1` non-fork repo, upgrade `verification_tier = 'github_verified'` and `trust_weight = 1.00`. Compute `github_oss_score = min(100, total_non_fork_stars * 2 + non_fork_repo_count * 5)`.
* **Bayesian RO Smoothing (`bayesian.py`):** `bayesian_ro_rate = (5 * 0.55 + ro_yes_count) / (5 + ro_known_total)` (prior `m = 0.55`, pseudo-count `C = 5`). Confidence tiers: `ro_known_total < 5` -> `'low'`, `5..14` -> `'medium'`, `>= 15` -> `'high'`.
## 6. Frontend & API Contracts (`frontend/`)
* **`GET /api/graph?company=<slug>&role=<role>&verifiedOnly=<bool>`:** Returns target entity metadata, overall smoothed RO rate, channel distribution percentages, and upstream `feeder_edges` sorted by `weighted_score DESC`.
* **`POST /api/submit`:** Validates payload with Zod, hashes IP with `IP_SALT` (rejects >5 submissions/hour per `ip_hash`), inserts into `submissions` with `status = 'pending'`.
* **`POST /api/admin/resolve`:** Validates `ADMIN_SECRET` header; allows approving a flagged string as a new `canonical_entity` or mapping it to an existing `entity_id` in `entity_aliases`, then marks submission `'pending'` for pipeline reprocessing.
* **Explorer UX (`/`):** Defaults to mobile-friendly ranked feeder bars (`MobileFeederList.tsx`) on small viewports and interactive `@xyflow/react` node canvas (`HiringGraph.tsx`) on desktop, with a toggle switch so users can use either. Clicking any upstream feeder node shifts focus to that company to trace multi-hop paths.
## 7. Phased Execution Order (Execute One Phase at a Time)
* **Phase 1 — Database & Seed Data:** Create `supabase/migrations/001_initial_schema.sql` and `supabase/seed.sql` (30 canonical companies/labs/OSS orgs, 100+ aliases, and 80 realistic feeder transitions).
* **Phase 2 — Python Pipeline & Pytest Suite:** Build `pipeline/` (`resolver.py`, `github_enricher.py`, `bayesian.py`, `run_pipeline.py`) and verify 100% passing `pytest` tests.
* **Phase 3 — Next.js Frontend & `shadcn/ui`:** Scaffold `frontend/`, initialize `shadcn/ui`, query Context7 for `@xyflow/react`, and build `/`, `/api/graph`, `HiringGraph`, `MobileFeederList`, and `CompanyInspector`.
* **Phase 4 — Submission & Admin Moderation:** Build `/submit`, `/api/submit`, `/admin`, and `/api/admin/resolve`, then run end-to-end verification.
