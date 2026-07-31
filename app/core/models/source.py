from datetime import date, datetime
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, Field, model_validator


class SourceType(StrEnum):
    LOCAL_FIXTURE = "local_fixture"
    YOUTUBE = "youtube"
    GOOGLE_PLACES = "google_places"
    WEATHER = "weather"
    WEB_SEARCH = "web_search"


class SourceSignal(BaseModel):
    source_type: SourceType
    title: str
    url: str | None = None
    published_at: date | None = None
    channel_name: str | None = None
    extracted_keywords: list[str] = Field(default_factory=list)
    matched_place_names: list[str] = Field(default_factory=list)
    confidence_impact: float = Field(ge=-1.0, le=1.0)
    notes: str | None = None
    live_signal: bool = False
    last_checked: datetime = Field(default_factory=datetime.utcnow)
    fallback_used: bool = False

    @model_validator(mode="after")
    def validate_live_youtube_recency(self) -> Self:
        """Require live YouTube source signals to come from the 2026 planning year."""
        if (
            self.source_type == SourceType.YOUTUBE
            and self.live_signal
            and self.published_at is not None
            and self.published_at.year != 2026
        ):
            raise ValueError("live YouTube source signals must be published in 2026")
        return self
