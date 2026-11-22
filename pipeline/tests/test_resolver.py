import pytest

import config
from resolver import Resolver, load_seed_aliases, normalize

ENTITIES = {
    "Amazon": "id-amzn",
    "Capital One": "id-c1",
    "Google DeepMind": "id-gdm",
    "Meta": "id-meta",
    "Jane Street": "id-js",
}
ALIASES = {
    "aws": ("id-amzn", True),
    "capone": ("id-c1", True),
    "fair": ("id-meta", True),
    "unverifiedname": ("id-js", False),
}


@pytest.fixture
def r():
    return Resolver(ENTITIES, ALIASES)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("  Amazon, Inc. ", "amazon"),
        ("Capital One Financial", "capital one"),
        ("Acme Technologies LLC", "acme"),
        ("Amazon.com", "amazon com"),
        ("AT&T", "at t"),
        ("Foo   Bar", "foo bar"),
        ("Labs", "labs"),  # suffix-only name is kept
        ("", ""),
        ("!!!", ""),
    ],
)
def test_normalize(raw, expected):
    assert normalize(raw) == expected


def test_exact_canonical(r):
    res = r.resolve("Amazon Inc.")
    assert (res.status, res.entity_id, res.method, res.confidence) == (
        "resolved", "id-amzn", "exact", 1.0)
    assert res.new_alias is None


def test_exact_alias_case_insensitive(r):
    assert r.resolve("  AWS ").entity_id == "id-amzn"


def test_unverified_alias_still_exact(r):
    res = r.resolve("UnverifiedName")
    assert res.method == "exact" and res.entity_id == "id-js"


def test_fuzzy_auto_resolve(r):
    res = r.resolve("Jane Streeet")  # typo, score >= 90
    assert res.status == "resolved" and res.method == "fuzzy"
    assert res.entity_id == "id-js"
    assert res.confidence >= 0.9
    assert res.new_alias == "jane streeet"


def test_fuzzy_auto_resolve_cached_as_exact(r):
    r.resolve("Jane Streeet")
    again = r.resolve("Jane Streeet")
    assert again.method == "exact" and again.new_alias is None


def test_fuzzy_token_order_insensitive(r):
    assert r.resolve("Street Jane").entity_id == "id-js"


def test_ambiguous_flagged(r):
    res = r.resolve("Googl DeepMind Labz")  # in the 78..90 band
    assert res.status == "flagged"
    assert res.flag_reason == "ambiguous_fuzzy_match"
    assert res.entity_id == "id-gdm"
    assert 0.78 <= res.confidence < 0.90


def test_unknown_is_new_entity_candidate(r):
    res = r.resolve("Totally Unknown Startup")
    assert res.status == "flagged"
    assert res.flag_reason == "new_entity_candidate"
    assert res.entity_id is None


@pytest.mark.parametrize("raw", ["", "   ", "!!!"])
def test_empty_input_flagged(r, raw):
    res = r.resolve(raw)
    assert res.status == "flagged" and res.flag_reason == "new_entity_candidate"


def test_unverified_alias_excluded_from_fuzzy(r):
    # near-miss of an *unverified* alias must not fuzzy-match to it
    res = r.resolve("unverifiedname2x")
    assert res.status == "flagged" and res.entity_id is None


def test_threshold_boundaries(monkeypatch):
    class FakeProc:
        score = 0

        @classmethod
        def extractOne(cls, *a, **k):
            return ("amazon", cls.score, 0)

    monkeypatch.setattr("resolver.process", FakeProc)
    r = Resolver({"Amazon": "id"}, {})
    for score, status, reason in [
        (90, "resolved", None),
        (89.9, "flagged", "ambiguous_fuzzy_match"),
        (78, "flagged", "ambiguous_fuzzy_match"),
        (77.9, "flagged", "new_entity_candidate"),
    ]:
        FakeProc.score = score
        res = r.resolve(f"zzz unmatched {score}")
        assert (res.status, res.flag_reason) == (status, reason), score


def test_no_choices(monkeypatch):
    r = Resolver({}, {})
    assert r.resolve("anything").flag_reason == "new_entity_candidate"


def test_seed_aliases_file_shape():
    seed = load_seed_aliases(config.SEED_ALIASES_PATH)
    assert len(seed) >= 100
    assert seed["aws"] == "Amazon"
    assert seed["capone"] == "Capital One"
    assert seed["fair"] == "Meta"
    assert seed["gdm"] == "Google DeepMind"
    assert all(k == k.lower().strip() for k in seed)


def test_seed_aliases_resolve_end_to_end():
    seed = load_seed_aliases(config.SEED_ALIASES_PATH)
    names = set(seed.values())
    r = Resolver({n: f"id-{n}" for n in names}, {a: (f"id-{c}", True) for a, c in seed.items()})
    for alias, canonical in seed.items():
        res = r.resolve(alias)
        assert res.status == "resolved", alias
        assert res.entity_id == f"id-{canonical}", alias
