from datetime import date, timedelta
from typing import Self

from pydantic import BaseModel, Field, model_validator


class Traveler(BaseModel):
    label: str
    age: int = Field(gt=0, lt=130)


class TripRequest(BaseModel):
    origin: str
    destination: str
    start_date: date
    end_date: date
    travelers: list[Traveler]
    preferences: list[str] = Field(default_factory=list)
    selected_stay_area: str | None = None
    live_data_enabled: bool = True

    @model_validator(mode="after")
    def validate_date_order(self) -> Self:
        """Reject date ranges where the trip ends before it starts."""
        if self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self

    @property
    def trip_dates(self) -> list[date]:
        """Return all trip dates in the inclusive date range."""
        day_count = (self.end_date - self.start_date).days + 1
        return [self.start_date + timedelta(days=offset) for offset in range(day_count)]

    @classmethod
    def default_family_trip(cls) -> Self:
        """Build the default Seoul to Busan family trip request."""
        return cls(
            origin="Seoul Station",
            destination="Busan",
            start_date=date(2026, 8, 16),
            end_date=date(2026, 8, 19),
            travelers=[
                Traveler(label="Father", age=46),
                Traveler(label="Mother", age=44),
                Traveler(label="Son", age=12),
            ],
            preferences=[
                "family-friendly",
                "balanced-pace",
                "local-food",
                "weather-aware",
                "fallback-ready",
            ],
        )
