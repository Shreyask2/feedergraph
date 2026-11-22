"""Bayesian-smoothed return-offer rate + confidence tier."""
from config import (
    BAYES_PRIOR_RATE,
    BAYES_PSEUDO_COUNT,
    CONFIDENCE_HIGH_MIN,
    CONFIDENCE_MEDIUM_MIN,
)


def _check(ro_yes_count: int, ro_known_total: int) -> None:
    if ro_yes_count < 0 or ro_known_total < 0 or ro_yes_count > ro_known_total:
        raise ValueError(f"invalid RO counts: yes={ro_yes_count}, total={ro_known_total}")


def bayesian_ro_rate(ro_yes_count: int, ro_known_total: int) -> float:
    _check(ro_yes_count, ro_known_total)
    rate = (BAYES_PSEUDO_COUNT * BAYES_PRIOR_RATE + ro_yes_count) / (
        BAYES_PSEUDO_COUNT + ro_known_total
    )
    return round(rate, 4)  # column is NUMERIC(5,4)


def confidence_level(ro_known_total: int) -> str:
    if ro_known_total < 0:
        raise ValueError("ro_known_total must be >= 0")
    if ro_known_total < CONFIDENCE_MEDIUM_MIN:
        return "low"
    if ro_known_total < CONFIDENCE_HIGH_MIN:
        return "medium"
    return "high"
