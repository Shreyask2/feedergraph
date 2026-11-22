"""Pipeline constants and env-driven settings. Values mirror PLAN.md section 5."""
import os
from dataclasses import dataclass
from pathlib import Path

SEED_ALIASES_PATH = Path(__file__).resolve().parent.parent / "data" / "seed_aliases.json"

CORPORATE_SUFFIXES = frozenset(
    {"inc", "llc", "corp", "technologies", "financial", "labs", "platforms"}
)

FUZZY_AUTO_RESOLVE = 90  # score >= 90: resolve + save unverified alias
FUZZY_AMBIGUOUS = 78  # 78 <= score < 90: flag for review; < 78: new entity candidate

BAYES_PRIOR_RATE = 0.55
BAYES_PSEUDO_COUNT = 5
CONFIDENCE_MEDIUM_MIN = 5
CONFIDENCE_HIGH_MIN = 15

TRUST_UNVERIFIED = 0.50
TRUST_GITHUB_VERIFIED = 1.00

GITHUB_API = "https://api.github.com"


@dataclass(frozen=True)
class Settings:
    database_url: str
    github_token: str | None = None


def load_settings() -> Settings:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return Settings(database_url=url, github_token=os.environ.get("GITHUB_TOKEN") or None)
