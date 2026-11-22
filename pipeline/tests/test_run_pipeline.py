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
        github_username=None, received_return_offer=True,
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


def test_github_verified_weights_edges(resolver):
    client = gh(lambda r: httpx.Response(200, json=[{"fork": False, "stargazers_count": 3}]))
    out = rp.process_submission(sub(github_username="octo"), resolver, client)
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
        rp.process_submission(sub(github_username="octo"), resolver, client)


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


ROW = ("s1", "Meta", "SWE", ["Amazon"], "referral", None, True)


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
    conn = FakeConn([("s2", "Unknown Zzz Qq", "SWE", [], "referral", None, None)])
    counts = rp.run(conn, NO_GH)
    assert counts["flagged"] == 1
    assert not any("feeder_edges" in x for x in sqls(conn))
    flag = [p for x, p in conn.log if "status = 'flagged'" in x][0]
    assert flag == ("new_entity_candidate", "s2")


def test_run_saves_fuzzy_alias_unverified():
    conn = FakeConn([("s3", "Amazoon", "SWE", [], "referral", None, None)])
    rp.run(conn, NO_GH)
    ins = [x for x in sqls(conn) if x.startswith("INSERT INTO entity_aliases")]
    assert len(ins) == 1 and "'fuzzy'" in ins[0] and "false" in ins[0]


def test_run_skips_on_github_failure():
    conn = FakeConn([("s4", "Meta", "SWE", ["Amazon"], "referral", "octo", True)])
    counts = rp.run(conn, gh(lambda r: httpx.Response(500)))
    assert counts == {"resolved": 0, "flagged": 0, "skipped": 1}
    assert conn.tx == 0
    assert not any(x.startswith("UPDATE submissions") for x in sqls(conn))


def test_run_no_pending():
    assert rp.run(FakeConn([]), NO_GH) == {"resolved": 0, "flagged": 0, "skipped": 0}
