"""GitHub verification + OSS score via the public REST API."""
import re
from dataclasses import dataclass

import httpx

from config import GITHUB_API, TRUST_GITHUB_VERIFIED, TRUST_UNVERIFIED

# GitHub logins: alphanumerics/hyphens, 1-39 chars. Validates before URL interpolation.
_USERNAME = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")


@dataclass(frozen=True)
class GitHubResult:
    verification_tier: str = "unverified"
    trust_weight: float = TRUST_UNVERIFIED
    oss_score: int = 0


def oss_score(stars: int, repo_count: int) -> int:
    return min(100, stars * 2 + repo_count * 5)


def enrich(username: str | None, client: httpx.Client) -> GitHubResult:
    """Unverified result for missing/invalid/unknown users or users with no
    non-fork repos. Network/API errors (incl. rate limits) raise httpx.HTTPError
    so the caller can retry later instead of recording a false 'unverified'."""
    if not username or not _USERNAME.match(username.strip()):
        return GitHubResult()
    resp = client.get(
        f"{GITHUB_API}/users/{username.strip()}/repos", params={"per_page": 100}
    )
    if resp.status_code == 404:
        return GitHubResult()
    resp.raise_for_status()
    own = [r for r in resp.json() if not r.get("fork")]
    if not own:
        return GitHubResult()
    stars = sum(r.get("stargazers_count", 0) for r in own)
    return GitHubResult("github_verified", TRUST_GITHUB_VERIFIED, oss_score(stars, len(own)))


def make_client(token: str | None = None) -> httpx.Client:
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return httpx.Client(headers=headers, timeout=10.0)
