from datetime import date

from app.core.data_sources.youtube_data_api import YouTubeDataApiSource
from app.core.models import SourceSignal, SourceType
from app.core.scoring.confidence import clamp_confidence, signal_score
from app.core.tools.youtube import filter_2026_youtube_signals, rank_video_signals


def _signal(
    source_type: SourceType,
    title: str,
    published_at: date | None,
    live_signal: bool,
    extracted_keywords: list[str] | None = None,
    matched_place_names: list[str] | None = None,
) -> SourceSignal:
    return SourceSignal(
        source_type=source_type,
        title=title,
        published_at=published_at,
        extracted_keywords=extracted_keywords or [],
        matched_place_names=matched_place_names or [],
        confidence_impact=0.05,
        live_signal=live_signal,
    )


def test_filter_2026_youtube_signals_includes_only_live_youtube_with_2026_date() -> None:
    matching = _signal(SourceType.YOUTUBE, "Busan 2026 beach", date(2026, 8, 1), True)
    undated = _signal(SourceType.WEB_SEARCH, "Web search", None, False)
    not_live = _signal(SourceType.YOUTUBE, "Seed video", date(2026, 8, 1), False)

    filtered = filter_2026_youtube_signals([matching, undated, not_live])

    assert filtered == [matching]


def test_filter_2026_youtube_signals_excludes_old_2025_youtube_records() -> None:
    old_signal = _signal(SourceType.YOUTUBE, "Busan 2025 beach", date(2025, 8, 1), False)
    current_signal = _signal(SourceType.YOUTUBE, "Busan 2026 beach", date(2026, 8, 1), True)

    filtered = filter_2026_youtube_signals([old_signal, current_signal])

    assert filtered == [current_signal]


def test_filter_2026_youtube_signals_excludes_non_youtube_records() -> None:
    web_signal = _signal(SourceType.WEB_SEARCH, "Busan 2026 web", date(2026, 8, 1), True)
    local_signal = _signal(SourceType.LOCAL_FIXTURE, "Busan local", date(2026, 8, 1), True)

    filtered = filter_2026_youtube_signals([web_signal, local_signal])

    assert filtered == []


def test_rank_video_signals_prefers_family_place_matching_2026_signals() -> None:
    strong_signal = _signal(
        SourceType.YOUTUBE,
        "Family day at Haeundae",
        date(2026, 8, 1),
        True,
        extracted_keywords=["family", "beach"],
        matched_place_names=["Haeundae Beach"],
    )
    weak_signal = _signal(
        SourceType.YOUTUBE,
        "Generic Busan update",
        date(2026, 8, 1),
        True,
        extracted_keywords=["nightlife"],
        matched_place_names=[],
    )

    ranked = rank_video_signals([weak_signal, strong_signal], ["family", "beach"])

    assert ranked == [strong_signal, weak_signal]


def test_clamp_confidence_clamps_below_zero_and_above_one() -> None:
    assert clamp_confidence(-0.2) == 0.0
    assert clamp_confidence(1.2) == 1.0
    assert clamp_confidence(0.7) == 0.7


def test_signal_score_rewards_2026_freshness() -> None:
    fresh = _signal(SourceType.YOUTUBE, "Fresh", date(2026, 8, 1), True)
    stale = _signal(SourceType.YOUTUBE, "Stale", date(2025, 8, 1), False)

    assert signal_score(fresh, []) > signal_score(stale, [])


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload


class _FakeClient:
    def __init__(self) -> None:
        self.params: dict | None = None

    def get(self, url: str, params: dict) -> _FakeResponse:
        self.params = params
        return _FakeResponse(
            200,
            {
                "items": [
                    {
                        "id": {"videoId": "abc123"},
                        "snippet": {
                            "title": "Busan family travel 2026",
                            "publishedAt": "2026-07-01T00:00:00Z",
                            "channelTitle": "Travel Channel",
                        },
                    },
                    {
                        "id": {"videoId": "old"},
                        "snippet": {
                            "title": "Busan family travel 2025",
                            "publishedAt": "2025-07-01T00:00:00Z",
                            "channelTitle": "Old Channel",
                        },
                    },
                ]
            },
        )


def test_youtube_data_api_source_exposes_search_travel_videos() -> None:
    client = _FakeClient()
    source = YouTubeDataApiSource(api_key="key", client=client)

    signals = source.search_travel_videos("Busan family", max_results=3)

    assert client.params is not None
    assert client.params["publishedAfter"] == "2026-01-01T00:00:00Z"
    assert client.params["maxResults"] == 3
    assert [signal.title for signal in signals] == ["Busan family travel 2026"]
