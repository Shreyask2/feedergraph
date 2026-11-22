# CLAUDE.md — FeederGraph Project Rules
## Source of Truth
* Always read `PLAN.md` first before making architectural or schema decisions.
* Execute strictly **one phase at a time** as requested by the user, then stop and summarize what was created and how to verify it.
## Active Skills & Workflow
* **`karpathy-guidelines`:** Keep changes surgical and minimal. Do not add unrequested abstractions, extra dependencies, or speculative features outside `PLAN.md`.
* **`supabase-postgres-best-practices`:** Enforce strict RLS, parameterize all queries, and index foreign keys/lookup columns.
* **`frontend-design`:** Build a crisp, high-contrast, data-dense analytics aesthetic. Avoid generic AI SaaS boilerplate.
* **`python-testing-patterns`:** Write thorough `pytest` unit tests for every module in `pipeline/src/`.
* **Context7 MCP:** Always query Context7 before writing code for `@xyflow/react`, `shadcn/ui`, or Next.js App Router to verify current APIs.
## Verification Rules (Mandatory Before Finishing Any Phase)
* **Phase 1 (Database):** Verify SQL syntax, foreign key constraints, check constraints, and confirm `seed.sql` inserts 30 entities, 100+ aliases, and 80 feeder edges cleanly.
* **Phase 2 (Python Pipeline):** Run `pytest` inside `pipeline/` and confirm 100% of tests pass before stopping.
* **Phase 3 & 4 (Frontend):** Run `npm run typecheck` (or `npx tsc --noEmit`) and `npm run build` inside `frontend/` to confirm zero TypeScript or Next.js build errors before stopping.
## Security & Privacy
* Never commit `.env` files or API keys.
* Never store raw IP addresses or raw emails—only salted SHA-256 hashes.
