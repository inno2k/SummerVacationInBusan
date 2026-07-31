from pydantic import BaseModel, ConfigDict, Field

from app.core.models.source import SourceSignal


class Coordinates(BaseModel):
    model_config = ConfigDict(frozen=True)

    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)


class PlaceCandidate(BaseModel):
    name: str
    area: str
    address: str | None = None
    category: str
    tags: list[str] = Field(default_factory=list)
    coordinates: Coordinates | None = None
    family_score: float = Field(ge=0.0, le=1.0)
    food_score: float = Field(ge=0.0, le=1.0)
    weather_suitability: str
    fatigue_impact: str
    source_signals: list[SourceSignal] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
