"""GitHub verification + OSS score via the public REST API."""
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from config import GITHUB_API, GITHUB_MIN_ACCOUNT_AGE_DAYS, TRUST_GITHUB_VERIFIED, TRUST_UNVERIFIED

# GitHub logins: alphanumerics/hyphens, 1-39 chars. Validates before URL interpolation.
_USERNAME = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")


@dataclass(frozen=True)
class GitHubResult:
    verification_tier: str = "unverified"
    trust_weight: float = TRUST_UNVERIFIED
    oss_score: int = 0


def oss_score(stars: int, repo_count: int) -> int:
    return min(100, stars * 2 + repo_count * 5)


def enrich(
    username: str | None,
    user_id: int | None,
    client: httpx.Client,
    now: datetime | None = None,
) -> GitHubResult:
    """Verify an OAuth-proven GitHub identity.

    Verified needs: a user_id from Supabase OAuth (manual usernames are spoofable),
    the account's id matching it, account age >= 30 days, and >= 1 non-fork repo.
    Anything else is unverified. Network/API errors (incl. rate limits) raise
    httpx.HTTPError so the caller retries later instead of recording 'unverified'."""
    if not username or user_id is None or not _USERNAME.match(username.strip()):
        return GitHubResult()
    login = username.strip()
    user = client.get(f"{GITHUB_API}/users/{login}")
    if user.status_code == 404:
        return GitHubResult()
    user.raise_for_status()
    info = user.json()
    if info.get("id") != int(user_id):  # handle renamed/reassigned since sign-in
        return GitHubResult()
    created = datetime.fromisoformat(info["created_at"].replace("Z", "+00:00"))
    if (now or datetime.now(timezone.utc)) - created < timedelta(days=GITHUB_MIN_ACCOUNT_AGE_DAYS):
        return GitHubResult()
    resp = client.get(f"{GITHUB_API}/users/{login}/repos", params={"per_page": 100})
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
