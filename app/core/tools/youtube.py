from app.core.models import SourceSignal, SourceType
from app.core.scoring.confidence import signal_score


def filter_2026_youtube_signals(signals: list[SourceSignal]) -> list[SourceSignal]:
    """Return live YouTube signals published during 2026."""
    return [
        signal
        for signal in signals
        if signal.source_type == SourceType.YOUTUBE
        and signal.live_signal
        and signal.published_at is not None
        and signal.published_at.year == 2026
    ]


def rank_video_signals(
    signals: list[SourceSignal],
    preferred_keywords: list[str],
) -> list[SourceSignal]:
    """Rank 2026 YouTube signals by confidence and keyword relevance."""
    return sorted(
        filter_2026_youtube_signals(signals),
        key=lambda signal: signal_score(signal, preferred_keywords),
        reverse=True,
    )
