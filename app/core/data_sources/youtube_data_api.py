from datetime import date
from typing import Any

import httpx

from app.core.data_sources.base import DataSourceError
from app.core.models import SourceSignal, SourceType

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
PUBLISHED_AFTER_2026 = "2026-01-01T00:00:00Z"


class YouTubeDataApiSource:
    """Live source backed by the YouTube Data API search endpoint."""

    def __init__(
        self,
        api_key: str,
        client: httpx.Client | None = None,
        max_results: int = 10,
    ) -> None:
        """Store YouTube API dependencies and search defaults."""
        self.api_key = api_key
        self.client = client or httpx.Client(timeout=10.0)
        self.max_results = max_results

    def search_travel_videos(
        self, query: str, max_results: int | None = None
    ) -> list[SourceSignal]:
        """Return valid live 2026 YouTube source signals for a query."""
        response = self.client.get(
            YOUTUBE_SEARCH_URL,
            params={
                "part": "snippet",
                "type": "video",
                "q": query,
                "key": self.api_key,
                "maxResults": max_results or self.max_results,
                "publishedAfter": PUBLISHED_AFTER_2026,
            },
        )
        if response.status_code >= 400:
            raise DataSourceError(
                f"YouTube Data API search failed with status {response.status_code}"
            )

        data = response.json()
        items = data.get("items", [])
        if not isinstance(items, list):
            raise DataSourceError("YouTube Data API response items must be a list.")

        signals: list[SourceSignal] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            signal = self._signal_from_item(item)
            if signal is not None:
                signals.append(signal)
        return signals

    def _signal_from_item(self, item: dict[str, Any]) -> SourceSignal | None:
        snippet = item.get("snippet")
        if not isinstance(snippet, dict):
            return None

        published_at = self._parse_2026_date(snippet.get("publishedAt"))
        title = snippet.get("title")
        if published_at is None or not isinstance(title, str) or not title:
            return None

        video_id = self._video_id(item.get("id"))
        return SourceSignal(
            source_type=SourceType.YOUTUBE,
            title=title,
            url=f"https://www.youtube.com/watch?v={video_id}" if video_id else None,
            published_at=published_at,
            channel_name=self._optional_string(snippet.get("channelTitle")),
            extracted_keywords=[],
            matched_place_names=[],
            confidence_impact=0.05,
            live_signal=True,
        )

    def _parse_2026_date(self, value: object) -> date | None:
        if not isinstance(value, str):
            return None
        try:
            parsed = date.fromisoformat(value[:10])
        except ValueError:
            return None
        if parsed.year != 2026:
            return None
        return parsed

    def _video_id(self, value: object) -> str | None:
        if not isinstance(value, dict):
            return None
        video_id = value.get("videoId")
        if isinstance(video_id, str) and video_id:
            return video_id
        return None

    def _optional_string(self, value: object) -> str | None:
        if isinstance(value, str):
            return value
        return None
