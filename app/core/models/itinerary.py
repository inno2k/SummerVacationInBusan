from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Self

from pydantic import BaseModel, Field, model_validator

from app.core.models.place import PlaceCandidate
from app.core.models.source import SourceSignal


class OptionId(StrEnum):
    BALANCED = "balanced"
    KID_EXPERIENCE = "kid_experience"
    FOOD_REST = "food_rest"


class ScheduleItem(BaseModel):
    time_window: str
    place: PlaceCandidate
    activity: str
    transport_hint: str
    food_hint: str | None = None
    estimated_cost_level: str
    child_friendliness: float = Field(ge=0.0, le=1.0)
    fatigue_level: str
    source_refs: list[str] = Field(default_factory=list)


class ItineraryDay(BaseModel):
    date: date
    theme: str
    route_summary: str
    schedule_items: list[ScheduleItem]
    fallback_plan: str


class ItineraryOption(BaseModel):
    id: OptionId
    title: str
    positioning: str
    recommended_stay_area: str
    days: list[ItineraryDay]
    pros: list[str] = Field(default_factory=list)
    cautions: list[str] = Field(default_factory=list)
    estimated_budget_range: str
    confidence: float = Field(ge=0.0, le=1.0)


class ReplanChange(BaseModel):
    operation: str
    day: date
    explanation: str


class ReplanPatch(BaseModel):
    user_request: str
    affected_days: list[date] = Field(default_factory=list)
    changes: list[ReplanChange] = Field(default_factory=list)
    updated_schedule_items: list[ScheduleItem] = Field(default_factory=list)
    explanation: str
    source_audit: list[SourceSignal] = Field(default_factory=list)


class ItineraryBundle(BaseModel):
    request_summary: str
    assumptions: list[str] = Field(default_factory=list)
    options: list[ItineraryOption]
    selected_option_id: OptionId | None = None
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    emergency_playbook: dict[str, str] = Field(default_factory=dict)
    source_audit: list[SourceSignal] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_required_option_ids(self) -> Self:
        """Require exactly one itinerary option for each supported option id."""
        required_ids = {OptionId.BALANCED, OptionId.KID_EXPERIENCE, OptionId.FOOD_REST}
        option_ids = [option.id for option in self.options]
        if len(option_ids) != len(required_ids) or set(option_ids) != required_ids:
            raise ValueError("options must exactly include balanced, kid_experience, and food_rest")
        return self
