"""Process pending submissions: resolve names, enrich GitHub, upsert feeder_edges.

Run: DATABASE_URL=... [GITHUB_TOKEN=...] python src/run_pipeline.py
"""
import logging
from dataclasses import dataclass, field

import httpx
import psycopg

import config
from bayesian import bayesian_ro_rate, confidence_level
from github_enricher import GitHubResult, enrich, make_client
from resolver import Resolver, load_seed_aliases, normalize

log = logging.getLogger("pipeline")


@dataclass
class EdgeDelta:
    source_id: str
    target_id: str
    role: str
    verified: int
    trust_weight: float
    ro_yes: int
    ro_known: int
    channel: str


@dataclass
class Outcome:
    status: str
    flag_reason: str | None = None
    target_id: str | None = None
    prior_ids: list[str] = field(default_factory=list)
    github: GitHubResult = field(default_factory=GitHubResult)
    new_aliases: list[tuple[str, str, float]] = field(default_factory=list)  # alias, entity, conf
    edges: list[EdgeDelta] = field(default_factory=list)


def process_submission(sub: dict, resolver: Resolver, gh_client) -> Outcome:
    """Pure decision logic for one pending submission (no DB access)."""
    new_aliases: list[tuple[str, str, float]] = []

    def resolve(raw: str):
        res = resolver.resolve(raw)
        if res.new_alias:
            new_aliases.append((res.new_alias, res.entity_id, res.confidence))
        return res

    target = resolve(sub["target_company_raw"])
    if target.status == "flagged":
        return Outcome("flagged", target.flag_reason)

    prior_ids: list[str] = []
    for raw in sub["prior_experiences_raw"] or []:
        res = resolve(raw)
        if res.status == "flagged":
            return Outcome("flagged", res.flag_reason)
        prior_ids.append(res.entity_id)

    gh = enrich(sub["github_username"], gh_client)
    ro = sub["received_return_offer"]
    edges = [
        EdgeDelta(
            src, target.entity_id, sub["role_category"],
            int(gh.verification_tier == "github_verified"), gh.trust_weight,
            int(ro is True), int(ro is not None), sub["channel"],
        )
        # dedupe; a company listing itself as prior experience is not a feeder
        for src in dict.fromkeys(prior_ids)
        if src != target.entity_id
    ]
    return Outcome("resolved", None, target.entity_id, prior_ids, gh, new_aliases, edges)


_PENDING = """SELECT id, target_company_raw, role_category, prior_experiences_raw,
  channel, github_username, received_return_offer
  FROM submissions WHERE status = 'pending' ORDER BY created_at"""

_UPSERT_EDGE = """INSERT INTO feeder_edges (source_entity_id, target_entity_id, role_category,
  raw_count, verified_count, weighted_score, ro_yes_count, ro_known_total, top_channel)
  VALUES (%s, %s, %s, 1, %s, %s, %s, %s, %s)
  ON CONFLICT (source_entity_id, target_entity_id, role_category) DO UPDATE SET
    raw_count = feeder_edges.raw_count + 1,
    verified_count = feeder_edges.verified_count + EXCLUDED.verified_count,
    weighted_score = feeder_edges.weighted_score + EXCLUDED.weighted_score,
    ro_yes_count = feeder_edges.ro_yes_count + EXCLUDED.ro_yes_count,
    ro_known_total = feeder_edges.ro_known_total + EXCLUDED.ro_known_total,
    top_channel = COALESCE(feeder_edges.top_channel, EXCLUDED.top_channel),
    updated_at = now()
  RETURNING id, ro_yes_count, ro_known_total"""


def load_resolver(cur) -> Resolver:
    cur.execute("SELECT id, name FROM canonical_entities")
    rows = cur.fetchall()
    entities = {name: str(eid) for eid, name in rows}
    cur.execute("SELECT alias, entity_id, is_verified FROM entity_aliases")
    aliases = {a: (str(eid), bool(v)) for a, eid, v in cur.fetchall()}
    return Resolver(entities, aliases)


def apply_outcome(cur, sub_id, out: Outcome) -> None:
    for alias, eid, conf in out.new_aliases:
        cur.execute(
            """INSERT INTO entity_aliases (alias, entity_id, match_method, confidence, is_verified)
               VALUES (%s, %s, 'fuzzy', %s, false) ON CONFLICT (alias) DO NOTHING""",
            (alias, eid, conf),
        )
    if out.status == "flagged":
        cur.execute(
            "UPDATE submissions SET status = 'flagged', flag_reason = %s WHERE id = %s",
            (out.flag_reason, sub_id),
        )
        return
    cur.execute(
        """UPDATE submissions SET status = 'resolved', flag_reason = NULL,
           target_entity_id = %s, prior_entity_ids = %s::uuid[],
           verification_tier = %s, trust_weight = %s, github_oss_score = %s
           WHERE id = %s""",
        (out.target_id, out.prior_ids, out.github.verification_tier,
         out.github.trust_weight, out.github.oss_score, sub_id),
    )
    for e in out.edges:
        cur.execute(
            _UPSERT_EDGE,
            (e.source_id, e.target_id, e.role, e.verified, e.trust_weight,
             e.ro_yes, e.ro_known, e.channel),
        )
        edge_id, yes, known = cur.fetchone()
        cur.execute(
            "UPDATE feeder_edges SET bayesian_ro_rate = %s, confidence_level = %s WHERE id = %s",
            (bayesian_ro_rate(yes, known), confidence_level(known), edge_id),
        )


def run(conn, gh_client) -> dict[str, int]:
    """One transaction per submission, so a failure never half-applies edges."""
    with conn.cursor() as cur:
        resolver = load_resolver(cur)
        cur.execute(_PENDING)
        pending = [
            dict(zip(
                ("id", "target_company_raw", "role_category", "prior_experiences_raw",
                 "channel", "github_username", "received_return_offer"), row))
            for row in cur.fetchall()
        ]
    counts = {"resolved": 0, "flagged": 0, "skipped": 0}
    for sub in pending:
        try:
            out = process_submission(sub, resolver, gh_client)
        except httpx.HTTPError as exc:  # leave pending; retried next run
            log.warning("skip %s: %s", sub["id"], exc)
            counts["skipped"] += 1
            continue
        with conn.transaction(), conn.cursor() as cur:
            apply_outcome(cur, sub["id"], out)
        counts[out.status] += 1
    return counts


def seed_missing_aliases(conn) -> int:
    """Insert seed_aliases.json rows whose canonical entity exists. Idempotent."""
    seed = load_seed_aliases(config.SEED_ALIASES_PATH)
    with conn.cursor() as cur:
        cur.execute("SELECT id, name FROM canonical_entities")
        by_name = {normalize(n): str(i) for i, n in cur.fetchall()}
    n = 0
    with conn.transaction(), conn.cursor() as cur:
        for alias, canonical in seed.items():
            eid = by_name.get(normalize(canonical))
            if eid is None:
                continue
            cur.execute(
                """INSERT INTO entity_aliases (alias, entity_id, match_method, confidence, is_verified)
                   VALUES (%s, %s, 'seed', 1.000, true) ON CONFLICT (alias) DO NOTHING""",
                (normalize(alias), eid),
            )
            n += cur.rowcount
    return n


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    settings = config.load_settings()
    with psycopg.connect(settings.database_url, autocommit=True) as conn, make_client(settings.github_token) as gh:
        log.info("seeded %d new aliases", seed_missing_aliases(conn))
        log.info("done: %s", run(conn, gh))


if __name__ == "__main__":
    main()
