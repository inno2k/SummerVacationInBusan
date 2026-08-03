from app.core.models import SourceSignal


def clamp_confidence(value: float) -> float:
    """Clamp a confidence value to the inclusive 0.0 to 1.0 range."""
    return max(0.0, min(1.0, value))


def signal_score(signal: SourceSignal, preferred_keywords: list[str]) -> float:
    """Return a sortable confidence score for a source signal."""
    preferred = {keyword.casefold() for keyword in preferred_keywords}
    keywords = {keyword.casefold() for keyword in signal.extracted_keywords}
    title = signal.title.casefold()

    keyword_matches = sum(
        1 for keyword in preferred if keyword in keywords or keyword in title
    )
    place_bonus = 0.1 if signal.matched_place_names else 0.0
    live_bonus = 0.1 if signal.live_signal else 0.0
    freshness_bonus = (
        0.2
        if signal.published_at is not None and signal.published_at.year == 2026
        else -0.5
    )
    keyword_bonus = min(0.4, keyword_matches * 0.15)

    return clamp_confidence(
        0.5
        + signal.confidence_impact
        + keyword_bonus
        + place_bonus
        + live_bonus
        + freshness_bonus
    )
