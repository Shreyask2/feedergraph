import httpx
import pytest

import run_pipeline as rp
from resolver import Resolver

ENT = {"Amazon": "A", "Google": "G", "Meta": "M"}


@pytest.fixture
def resolver():
    return Resolver(ENT, {})


def sub(**kw):
    base = dict(
        id="s1", target_company_raw="Meta", role_category="SWE",
        prior_experiences_raw=["Amazon", "Google"], channel="referral",
        github_username=None, github_user_id=None, received_return_offer=True,
    )
    return {**base, **kw}


def gh(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


NO_GH = gh(lambda r: (_ for _ in ()).throw(AssertionError("no api call expected")))


def test_resolved_basic(resolver):
    out = rp.process_submission(sub(), resolver, NO_GH)
    assert out.status == "resolved"
    assert out.target_id == "M" and out.prior_ids == ["A", "G"]
    assert out.github.trust_weight == 0.5
    assert [(e.source_id, e.target_id, e.ro_yes, e.ro_known, e.verified) for e in out.edges] == [
        ("A", "M", 1, 1, 0), ("G", "M", 1, 1, 0)]


def test_ro_unknown_and_no(resolver):
    unk = rp.process_submission(sub(received_return_offer=None), resolver, NO_GH).edges[0]
    assert (unk.ro_yes, unk.ro_known) == (0, 0)
    no = rp.process_submission(sub(received_return_offer=False), resolver, NO_GH).edges[0]
    assert (no.ro_yes, no.ro_known) == (0, 1)


def gh_ok(repos=None):
    """GitHub mock: id 42, old account, one original repo."""
    def h(req):
        if req.url.path.endswith("/repos"):
            return httpx.Response(200, json=repos or [{"fork": False, "stargazers_count": 3}])
        return httpx.Response(200, json={"id": 42, "created_at": "2020-01-01T00:00:00Z"})
    return gh(h)


VERIFIED = dict(github_username="octo", github_user_id=42)


def test_github_verified_weights_edges(resolver):
    out = rp.process_submission(sub(**VERIFIED), resolver, gh_ok())
    assert out.github.verification_tier == "github_verified"
    assert all(e.verified == 1 and e.trust_weight == 1.0 for e in out.edges)


def test_flagged_target_stops_early(resolver):
    out = rp.process_submission(sub(target_company_raw="Nowhere Corp Zzz"), resolver, NO_GH)
    assert (out.status, out.flag_reason) == ("flagged", "new_entity_candidate")
    assert out.edges == []


def test_flagged_prior(resolver):
    out = rp.process_submission(sub(prior_experiences_raw=["Amazon", "Qwxzy"]), resolver, NO_GH)
    assert out.status == "flagged"


def test_dedupe_and_self_excluded(resolver):
    out = rp.process_submission(
        sub(prior_experiences_raw=["Amazon", "amazon inc", "Meta"]), resolver, NO_GH)
    assert [e.source_id for e in out.edges] == ["A"]
    assert out.prior_ids == ["A", "A", "M"]


def test_no_priors_no_edges(resolver):
    for priors in ([], None):
        out = rp.process_submission(sub(prior_experiences_raw=priors), resolver, NO_GH)
        assert out.status == "resolved" and out.edges == []


def test_fuzzy_alias_collected(resolver):
    out = rp.process_submission(sub(target_company_raw="Googlee"), resolver, NO_GH)
    assert out.status == "resolved"
    assert [a[:2] for a in out.new_aliases] == [("googlee", "G")]


def test_github_error_propagates(resolver):
    client = gh(lambda r: httpx.Response(403))
    with pytest.raises(httpx.HTTPError):
        rp.process_submission(sub(**VERIFIED), resolver, client)


class FakeCursor:
    def __init__(self, conn):
        self.c = conn
        self.rowcount = 1

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        self.c.log.append((" ".join(sql.split()), params))
        self.last = sql

    def fetchall(self):
        s = " ".join(self.last.split())
        if s.startswith("SELECT id, name"):
            return [("A", "Amazon"), ("M", "Meta")]
        if s.startswith("SELECT alias"):
            return []
        if "FROM submissions" in s:
            return self.c.pending
        raise AssertionError(s)

    def fetchone(self):
        return ("edge1", 3, 4)


class FakeConn:
    def __init__(self, pending):
        self.pending, self.log, self.tx = pending, [], 0

    def cursor(self):
        return FakeCursor(self)

    def transaction(self):
        conn = self

        class Tx:
            def __enter__(s):
                conn.tx += 1

            def __exit__(s, *a):
                return False

        return Tx()


ROW = ("s1", "Meta", "SWE", ["Amazon"], "referral", None, None, True)


def sqls(conn):
    return [s for s, _ in conn.log]


def test_run_resolved_writes_everything():
    conn = FakeConn([ROW])
    counts = rp.run(conn, NO_GH)
    assert counts == {"resolved": 1, "flagged": 0, "skipped": 0}
    assert conn.tx == 1
    s = sqls(conn)
    assert any(x.startswith("UPDATE submissions SET status = 'resolved'") for x in s)
    assert any(x.startswith("INSERT INTO feeder_edges") for x in s)
    upd = [p for x, p in conn.log if x.startswith("UPDATE feeder_edges")][0]
    assert upd == (0.6389, "low", "edge1")  # (2.75+3)/(5+4)


def test_run_flagged_writes_flag_only():
    conn = FakeConn([("s2", "Unknown Zzz Qq", "SWE", [], "referral", None, None, None)])
    counts = rp.run(conn, NO_GH)
    assert counts["flagged"] == 1
    assert not any("feeder_edges" in x for x in sqls(conn))
    flag = [p for x, p in conn.log if "status = 'flagged'" in x][0]
    assert flag == ("new_entity_candidate", "s2")


def test_run_saves_fuzzy_alias_unverified():
    conn = FakeConn([("s3", "Amazoon", "SWE", [], "referral", None, None, None)])
    rp.run(conn, NO_GH)
    ins = [x for x in sqls(conn) if x.startswith("INSERT INTO entity_aliases")]
    assert len(ins) == 1 and "'fuzzy'" in ins[0] and "false" in ins[0]


def test_run_skips_on_github_failure():
    conn = FakeConn([("s4", "Meta", "SWE", ["Amazon"], "referral", "octo", 42, True)])
    counts = rp.run(conn, gh(lambda r: httpx.Response(500)))
    assert counts == {"resolved": 0, "flagged": 0, "skipped": 1}
    assert conn.tx == 0
    assert not any(x.startswith("UPDATE submissions") for x in sqls(conn))


def test_run_no_pending():
    assert rp.run(FakeConn([]), NO_GH) == {"resolved": 0, "flagged": 0, "skipped": 0}


# --- niche startups: auto-create for github_verified, moderate otherwise ---

def test_verified_unknown_target_auto_created(resolver):
    out = rp.process_submission(sub(target_company_raw="Rove (YC W24)", **VERIFIED), resolver, gh_ok())
    assert out.status == "resolved"
    [(eid, name, slug)] = out.new_entities
    assert (name, slug) == ("Rove", "rove")
    assert out.target_id == eid
    assert {e.target_id for e in out.edges} == {eid}
    assert all(e.verified == 1 for e in out.edges)


def test_verified_unknown_prior_auto_created(resolver):
    out = rp.process_submission(sub(prior_experiences_raw=["Amazon", "Zephyr Robotics (YC S25)"], **VERIFIED), resolver, gh_ok())
    assert out.status == "resolved"
    [(eid, name, slug)] = out.new_entities
    assert (name, slug) == ("Zephyr Robotics", "zephyr-robotics")
    assert [e.source_id for e in out.edges] == ["A", eid]


def test_auto_created_entity_reused_in_same_submission_and_run(resolver):
    out = rp.process_submission(sub(target_company_raw="Rove", prior_experiences_raw=["Rove (YC W24)"], **VERIFIED), resolver, gh_ok())
    assert len(out.new_entities) == 1 and out.edges == []  # self-edge dropped
    again = rp.process_submission(sub(target_company_raw="rove", **VERIFIED), resolver, gh_ok())
    assert again.new_entities == [] and again.target_id == out.target_id


def test_unverified_unknown_still_flagged(resolver):
    out = rp.process_submission(sub(target_company_raw="Rove (YC W24)"), resolver, NO_GH)
    assert (out.status, out.flag_reason, out.new_entities) == ("flagged", "new_entity_candidate", [])


def test_manual_username_without_oauth_id_not_trusted(resolver):
    out = rp.process_submission(sub(target_company_raw="Rove", github_username="octo"), resolver, NO_GH)
    assert out.status == "flagged" and out.new_entities == []


def test_verified_ambiguous_still_flagged():
    r = Resolver({"Google DeepMind": "GDM", "Meta": "M"}, {})
    out = rp.process_submission(sub(target_company_raw="Googl DeepMind Labz", prior_experiences_raw=[], **VERIFIED), r, gh_ok())
    assert (out.status, out.flag_reason, out.new_entities) == ("flagged", "ambiguous_fuzzy_match", [])


def test_verified_flag_after_create_keeps_entity(resolver):
    # target auto-created, then an ambiguous prior flags: entity must still be persisted
    r = Resolver({"Google DeepMind": "GDM"}, {})
    out = rp.process_submission(sub(target_company_raw="Rove", prior_experiences_raw=["Googl DeepMind Labz"], **VERIFIED), r, gh_ok())
    assert out.status == "flagged" and len(out.new_entities) == 1


def test_verified_punctuation_only_name_flagged(resolver):
    out = rp.process_submission(sub(target_company_raw="(YC W24)", **VERIFIED), resolver, gh_ok())
    assert out.status == "flagged" and out.new_entities == []


def test_run_inserts_startup_entity_before_edges():
    conn = FakeConn([("s5", "Rove (YC W24)", "SWE", ["Amazon"], "referral", "octo", 42, True)])
    counts = rp.run(conn, gh_ok())
    assert counts["resolved"] == 1
    s = sqls(conn)
    ins = [i for i, x in enumerate(s) if x.startswith("INSERT INTO canonical_entities")]
    edge = [i for i, x in enumerate(s) if x.startswith("INSERT INTO feeder_edges")]
    assert len(ins) == 1 and ins[0] < edge[0]
    params = [p for x, p in conn.log if x.startswith("INSERT INTO canonical_entities")][0]
    assert params[1:] == ("Rove", "rove", "startup")
