from datetime import datetime, timezone

import httpx
import pytest

from github_enricher import enrich, oss_score

NOW = datetime(2026, 11, 22, tzinfo=timezone.utc)
OLD = "2020-01-01T00:00:00Z"


def client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def repos(*specs):
    return [{"fork": f, "stargazers_count": s} for f, s in specs]


def api(repo_json=None, *, uid=42, created=OLD, user_status=200, repo_status=200, seen=None):
    """Mock GitHub: /users/{u} and /users/{u}/repos."""

    def h(req):
        if seen is not None:
            seen.append(str(req.url))
        if req.url.path.endswith("/repos"):
            return httpx.Response(repo_status, json=repo_json if repo_json is not None else [])
        return httpx.Response(user_status, json={"id": uid, "created_at": created})

    return client(h)


def no_call(req):
    raise AssertionError("must not call API")


def test_oss_score_formula():
    assert oss_score(0, 0) == 0
    assert oss_score(10, 3) == 35
    assert oss_score(1000, 50) == 100  # capped


def test_verified_user():
    seen = []
    res = enrich("octocat", 42, api(repos((False, 10), (False, 5), (True, 999)), seen=seen), NOW)
    assert res.verification_tier == "github_verified"
    assert res.trust_weight == 1.00
    assert res.oss_score == 15 * 2 + 2 * 5  # forks excluded
    assert seen[0].endswith("/users/octocat")
    assert seen[1].endswith("/users/octocat/repos?per_page=100")


def test_user_id_as_string_accepted():
    assert enrich("octocat", "42", api(repos((False, 0))), NOW).verification_tier == "github_verified"


def test_no_user_id_is_unverified_without_request():
    # manual usernames are spoofable: only OAuth-proven ids can verify
    assert enrich("octocat", None, client(no_call), NOW).verification_tier == "unverified"


def test_id_mismatch_unverified():
    seen = []
    res = enrich("octocat", 7, api(repos((False, 10)), uid=42, seen=seen), NOW)
    assert res.verification_tier == "unverified"
    assert len(seen) == 1  # repos not fetched


@pytest.mark.parametrize(
    "created,tier",
    [
        ("2026-11-01T00:00:00Z", "unverified"),  # 21 days
        ("2026-10-23T00:00:01Z", "unverified"),  # just under 30 days
        ("2026-10-23T00:00:00Z", "github_verified"),  # exactly 30 days
        (OLD, "github_verified"),
    ],
)
def test_account_age_threshold(created, tier):
    assert enrich("u", 42, api(repos((False, 1)), created=created), NOW).verification_tier == tier


def test_only_forks_not_verified():
    res = enrich("forker", 42, api(repos((True, 50))), NOW)
    assert (res.verification_tier, res.trust_weight, res.oss_score) == ("unverified", 0.5, 0)


def test_no_repos_not_verified():
    assert enrich("empty", 42, api([]), NOW).verification_tier == "unverified"


def test_missing_stars_key():
    res = enrich("u", 42, api([{"fork": False}]), NOW)
    assert res.verification_tier == "github_verified" and res.oss_score == 5


def test_user_404_unverified():
    assert enrich("ghost", 42, api(user_status=404), NOW).verification_tier == "unverified"


def test_repos_404_unverified():
    assert enrich("ghost", 42, api(repo_status=404), NOW).verification_tier == "unverified"


@pytest.mark.parametrize("name", [None, "", "   "])
def test_no_username_no_request(name):
    assert enrich(name, 42, client(no_call), NOW).verification_tier == "unverified"


@pytest.mark.parametrize("name", ["../admin", "a/b", "-bad", "x" * 40, "a b", "a?b=1"])
def test_invalid_username_no_request(name):
    assert enrich(name, 42, client(no_call), NOW).verification_tier == "unverified"


@pytest.mark.parametrize("status", [403, 429, 500])
def test_user_api_errors_raise(status):
    with pytest.raises(httpx.HTTPStatusError):
        enrich("octocat", 42, api(user_status=status), NOW)


@pytest.mark.parametrize("status", [403, 429, 500])
def test_repo_api_errors_raise(status):
    with pytest.raises(httpx.HTTPStatusError):
        enrich("octocat", 42, api(repo_status=status), NOW)


def test_network_error_raises():
    def h(req):
        raise httpx.ConnectError("down")

    with pytest.raises(httpx.HTTPError):
        enrich("octocat", 42, client(h), NOW)


def test_username_stripped():
    seen = []
    enrich(" octocat ", 42, api(user_status=404, seen=seen), NOW)
    assert seen[0].endswith("/users/octocat")


def test_defaults_to_current_time():
    # no `now`: an account created in 2020 is old enough today
    assert enrich("u", 42, api(repos((False, 0)))).verification_tier == "github_verified"
