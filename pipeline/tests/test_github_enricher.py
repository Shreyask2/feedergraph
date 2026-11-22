import httpx
import pytest

from github_enricher import enrich, oss_score


def client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def repos(*specs):
    return [{"fork": f, "stargazers_count": s} for f, s in specs]


def test_oss_score_formula():
    assert oss_score(0, 0) == 0
    assert oss_score(10, 3) == 35
    assert oss_score(1000, 50) == 100  # capped


def test_verified_user():
    seen = {}

    def h(req):
        seen["url"] = str(req.url)
        return httpx.Response(200, json=repos((False, 10), (False, 5), (True, 999)))

    res = enrich("octocat", client(h))
    assert res.verification_tier == "github_verified"
    assert res.trust_weight == 1.00
    assert res.oss_score == 15 * 2 + 2 * 5  # forks excluded
    assert seen["url"].endswith("/users/octocat/repos?per_page=100")


def test_only_forks_not_verified():
    res = enrich("forker", client(lambda r: httpx.Response(200, json=repos((True, 50)))))
    assert (res.verification_tier, res.trust_weight, res.oss_score) == ("unverified", 0.5, 0)


def test_no_repos_not_verified():
    res = enrich("empty", client(lambda r: httpx.Response(200, json=[])))
    assert res.verification_tier == "unverified"


def test_missing_stars_key():
    res = enrich("u", client(lambda r: httpx.Response(200, json=[{"fork": False}])))
    assert res.verification_tier == "github_verified" and res.oss_score == 5


def test_404_unverified():
    res = enrich("ghost", client(lambda r: httpx.Response(404)))
    assert res.verification_tier == "unverified"


@pytest.mark.parametrize("name", [None, "", "   "])
def test_no_username_no_request(name):
    def h(req):
        raise AssertionError("must not call API")

    assert enrich(name, client(h)).verification_tier == "unverified"


@pytest.mark.parametrize("name", ["../admin", "a/b", "-bad", "x" * 40, "a b", "a?b=1"])
def test_invalid_username_no_request(name):
    def h(req):
        raise AssertionError("must not call API")

    assert enrich(name, client(h)).verification_tier == "unverified"


@pytest.mark.parametrize("status", [403, 429, 500])
def test_api_errors_raise(status):
    with pytest.raises(httpx.HTTPStatusError):
        enrich("octocat", client(lambda r: httpx.Response(status)))


def test_network_error_raises():
    def h(req):
        raise httpx.ConnectError("down")

    with pytest.raises(httpx.HTTPError):
        enrich("octocat", client(h))


def test_username_stripped():
    seen = {}

    def h(req):
        seen["path"] = req.url.path
        return httpx.Response(404)

    enrich(" octocat ", client(h))
    assert seen["path"] == "/users/octocat/repos"
