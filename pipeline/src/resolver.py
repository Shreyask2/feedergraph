"""Company-name resolution: normalize -> exact alias -> RapidFuzz."""
import json
import re
from dataclasses import dataclass
from pathlib import Path

from rapidfuzz import fuzz, process

from config import CORPORATE_SUFFIXES, FUZZY_AMBIGUOUS, FUZZY_AUTO_RESOLVE

_PUNCT = re.compile(r"[^\w\s]|_")


def normalize(raw: str) -> str:
    """Lowercase, drop punctuation, strip corporate suffix tokens."""
    tokens = _PUNCT.sub(" ", raw.lower()).split()
    kept = [t for t in tokens if t not in CORPORATE_SUFFIXES]
    # a name made only of suffix words ("Labs") keeps them rather than vanishing
    return " ".join(kept or tokens)


@dataclass(frozen=True)
class Resolution:
    status: str  # 'resolved' | 'flagged'
    entity_id: str | None = None
    method: str | None = None  # 'exact' | 'fuzzy'
    confidence: float = 0.0
    flag_reason: str | None = None
    new_alias: str | None = None  # normalized alias to persist (fuzzy auto-resolve only)


def load_seed_aliases(path: Path) -> dict[str, str]:
    """seed_aliases.json: {alias: canonical name}."""
    return json.loads(Path(path).read_text())


class Resolver:
    def __init__(
        self,
        entities: dict[str, str],
        aliases: dict[str, tuple[str, bool]],
    ):
        """entities: canonical name -> id. aliases: alias -> (entity_id, is_verified)."""
        self._exact: dict[str, str] = {}
        self._fuzzy: dict[str, str] = {}
        for name, eid in entities.items():
            key = normalize(name)
            self._exact[key] = eid
            self._fuzzy[key] = eid
        for alias, (eid, verified) in aliases.items():
            key = normalize(alias)
            self._exact.setdefault(key, eid)
            if verified:
                self._fuzzy.setdefault(key, eid)
        self._choices = list(self._fuzzy)

    def resolve(self, raw: str) -> Resolution:
        key = normalize(raw)
        if not key:
            return Resolution("flagged", flag_reason="new_entity_candidate")
        if key in self._exact:
            return Resolution("resolved", self._exact[key], "exact", 1.0)
        match = process.extractOne(
            key, self._choices, scorer=fuzz.token_sort_ratio
        )
        if match is None:
            return Resolution("flagged", flag_reason="new_entity_candidate")
        choice, score, _ = match
        if score >= FUZZY_AUTO_RESOLVE:
            eid = self._fuzzy[choice]
            self._exact[key] = eid  # later duplicates in this run hit O(1) path
            return Resolution("resolved", eid, "fuzzy", round(score / 100, 3), new_alias=key)
        if score >= FUZZY_AMBIGUOUS:
            return Resolution(
                "flagged",
                self._fuzzy[choice],
                "fuzzy",
                round(score / 100, 3),
                "ambiguous_fuzzy_match",
            )
        return Resolution("flagged", flag_reason="new_entity_candidate")
