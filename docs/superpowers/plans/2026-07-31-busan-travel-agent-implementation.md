# Busan Travel Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an engine-first Busan family travel multi-agent planner that generates three itinerary options, supports shallow replanning, exports JSON and Markdown, and later runs through a local Streamlit web app.

**Architecture:** Start with a deterministic, testable Python engine using Pydantic models, local fixtures, and explicit data-source interfaces. Add optional live-source adapters behind the same interfaces so API keys can improve results without becoming required. Keep CrewAI orchestration thin and replaceable by routing all domain behavior through `PlannerEngine`, `ReplannerEngine`, tools, validation, scoring, and renderers.

**Tech Stack:** Python 3.11+, Pydantic v2, pytest, Streamlit, optional CrewAI, optional YouTube Data API, optional Google Places-compatible source, optional weather source.

---

## Scope Notes

This plan implements the approved spec in three vertical slices:

1. Engine MVP: models, fixtures, data sources, scoring, planner, replanner, renderers, CLI, and tests.
2. Local web planner: Streamlit wrapper around the same engine.
3. GitHub readiness: README, sample outputs, `.env.example`, and CI.

Booking, payment, KTX reservation automation, mobile app, collaborative editing, calendar integration, offline companion mode, and drag-and-drop map editing stay out of scope.

## File Responsibility Map

- `pyproject.toml`: package metadata, runtime dependencies, dev dependencies, pytest config.
- `.env.example`: optional API keys and runtime toggles.
- `README.md`: setup, demo commands, optional live-source configuration.
- `.github/workflows/ci.yml`: install and run tests.
- `app/core/models/*.py`: Pydantic models and enums only.
- `app/core/data_sources/base.py`: protocols, result wrappers, and source errors.
- `app/core/data_sources/local_fixtures.py`: JSON fixture loader and fallback data source.
- `app/core/data_sources/youtube_data_api.py`: optional YouTube adapter with 2026 filter.
- `app/core/tools/*.py`: stable functions used by agents and engines.
- `app/core/scoring/*.py`: deterministic ranking and confidence calculation.
- `app/core/orchestration/planner_engine.py`: main itinerary bundle generation.
- `app/core/orchestration/replanner_engine.py`: shallow patch generation.
- `app/core/rendering/*.py`: JSON and Markdown export.
- `app/cli/main.py`: CLI entry point.
- `app/web/streamlit_app.py`: local web planner.
- `data/fixtures/*.json`: API-free demo data.
- `tests/unit/*.py`: focused model, filtering, fallback, scoring, rendering tests.
- `tests/integration/*.py`: default planner, replanner, CLI output, and web-safe import tests.

---

### Task 1: Project Scaffold and Tooling

**Files:**
- Create: `pyproject.toml`
- Create: `.env.example`
- Create: `.gitignore`
- Create: package marker files under `app/`
- Test: `python -m pytest --version`

- [ ] **Step 1: Create package configuration**

Write `pyproject.toml`:

```toml
[project]
name = "summer-vacation-in-busan"
version = "0.1.0"
description = "Engine-first Busan family travel multi-agent planner"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
  "pydantic>=2.8,<3",
  "python-dotenv>=1.0,<2",
  "httpx>=0.27,<1",
  "typer>=0.12,<1",
  "rich>=13.7,<14",
  "streamlit>=1.36,<2"
]

[project.optional-dependencies]
agents = ["crewai>=0.51,<1"]
dev = ["pytest>=8.2,<9", "pytest-cov>=5,<6", "ruff>=0.5,<1"]

[project.scripts]
busan-planner = "app.cli.main:main"

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]

[tool.ruff]
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
```

- [ ] **Step 2: Create environment template**

Write `.env.example`:

```dotenv
LIVE_DATA_ENABLED=false
YOUTUBE_API_KEY=
GOOGLE_PLACES_API_KEY=
WEATHER_API_KEY=
OPENAI_API_KEY=
DEFAULT_TRIP_ORIGIN=Seoul Station
DEFAULT_TRIP_DESTINATION=Busan
DEFAULT_TRIP_START_DATE=2026-08-16
DEFAULT_TRIP_END_DATE=2026-08-19
```

- [ ] **Step 3: Create ignore rules**

Write `.gitignore`:

```gitignore
__pycache__/
*.py[cod]
.pytest_cache/
.ruff_cache/
.coverage
htmlcov/
.venv/
.env
outputs/*.json
outputs/*.md
.superpowers/
```

- [ ] **Step 4: Create package marker files**

Create empty `__init__.py` files in:

```text
app/
app/core/
app/core/models/
app/core/data_sources/
app/core/tools/
app/core/scoring/
app/core/orchestration/
app/core/rendering/
app/core/validation/
app/cli/
app/web/
```

- [ ] **Step 5: Install development dependencies**

Run: `python -m pip install -e .[dev]`

Expected: package installs successfully and `pytest` is available.

- [ ] **Step 6: Verify pytest runs**

Run: `python -m pytest --version`

Expected: output starts with `pytest` and exits with status 0.

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml .env.example .gitignore app
git commit -m "chore: scaffold Python project"
```

---

### Task 2: Core Pydantic Models

**Files:**
- Create: `app/core/models/source.py`
- Create: `app/core/models/place.py`
- Create: `app/core/models/emergency.py`
- Create: `app/core/models/trip_request.py`
- Create: `app/core/models/itinerary.py`
- Modify: `app/core/models/__init__.py`
- Test: `tests/unit/test_models.py`

- [ ] **Step 1: Write failing model tests**

Write `tests/unit/test_models.py`:

```python
from datetime import date

import pytest
from pydantic import ValidationError

from app.core.models import (
    ItineraryBundle,
    ItineraryDay,
    ItineraryOption,
    OptionId,
    PlaceCandidate,
    ScheduleItem,
    SourceSignal,
    SourceType,
    Traveler,
    TripRequest,
)


def test_default_trip_request_has_four_days() -> None:
    request = TripRequest.default_family_trip()

    assert request.origin == "Seoul Station"
    assert request.destination == "Busan"
    assert request.start_date == date(2026, 8, 16)
    assert request.end_date == date(2026, 8, 19)
    assert request.trip_dates == [
        date(2026, 8, 16),
        date(2026, 8, 17),
        date(2026, 8, 18),
        date(2026, 8, 19),
    ]
    assert [traveler.age for traveler in request.travelers] == [46, 44, 12]


def test_trip_request_rejects_reversed_dates() -> None:
    with pytest.raises(ValidationError):
        TripRequest(
            origin="Seoul Station",
            destination="Busan",
            start_date=date(2026, 8, 19),
            end_date=date(2026, 8, 16),
            travelers=[Traveler(label="Father", age=46)],
        )


def test_youtube_signal_requires_2026_when_live() -> None:
    with pytest.raises(ValidationError):
        SourceSignal(
            source_type=SourceType.YOUTUBE,
            title="2025 부산 맛집",
            published_at=date(2025, 7, 1),
            live_signal=True,
            confidence_impact=0.2,
        )


def test_itinerary_bundle_requires_three_option_ids() -> None:
    source = SourceSignal(
        source_type=SourceType.LOCAL_FIXTURE,
        title="fixture",
        confidence_impact=0.1,
    )
    place = PlaceCandidate(
        name="Haeundae Beach",
        area="Haeundae",
        category="beach",
        tags=["family"],
        family_score=0.8,
        food_score=0.2,
        weather_suitability="outdoor",
        fatigue_impact="medium",
        source_signals=[source],
        confidence=0.7,
    )
    item = ScheduleItem(
        time_window="10:00-12:00",
        place=place,
        activity="Walk along the beach",
        transport_hint="Subway or taxi",
        food_hint="Nearby cafes",
        estimated_cost_level="low",
        child_friendliness=0.8,
        fatigue_level="medium",
        source_refs=[source.title],
    )
    day = ItineraryDay(
        date=date(2026, 8, 16),
        theme="Arrival",
        route_summary="Busan Station to Haeundae",
        schedule_items=[item],
        fallback_plan="Move to indoor aquarium if raining.",
    )
    option = ItineraryOption(
        id=OptionId.BALANCED,
        title="Balanced",
        positioning="Balanced family itinerary",
        recommended_stay_area="Haeundae",
        days=[day],
        pros=["Efficient"],
        cautions=["Check hours"],
        estimated_budget_range="medium",
        confidence=0.7,
    )

    with pytest.raises(ValidationError):
        ItineraryBundle(
            request_summary="Family trip",
            assumptions=["No API keys"],
            options=[option],
            emergency_playbook={"late_night": "Use taxi and call 119 for emergencies."},
            source_audit=[source],
        )
```

- [ ] **Step 2: Run tests to verify failure**

Run: `python -m pytest tests/unit/test_models.py -v`

Expected: FAIL with import errors because model files do not exist.

- [ ] **Step 3: Implement source models**

Write `app/core/models/source.py`:

```python
from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SourceType(StrEnum):
    LOCAL_FIXTURE = "local_fixture"
    YOUTUBE = "youtube"
    GOOGLE_PLACES = "google_places"
    WEATHER = "weather"
    WEB_SEARCH = "web_search"


class SourceSignal(BaseModel):
    model_config = ConfigDict(frozen=True)

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
    def validate_youtube_year(self) -> "SourceSignal":
        if (
            self.source_type == SourceType.YOUTUBE
            and self.live_signal
            and self.published_at is not None
            and self.published_at.year != 2026
        ):
            raise ValueError("live YouTube travel signals must be published in 2026")
        return self
```

- [ ] **Step 4: Implement place models**

Write `app/core/models/place.py`:

```python
from pydantic import BaseModel, ConfigDict, Field

from app.core.models.source import SourceSignal


class Coordinates(BaseModel):
    model_config = ConfigDict(frozen=True)

    latitude: float
    longitude: float


class PlaceCandidate(BaseModel):
    name: str
    area: str
    category: str
    address: str | None = None
    coordinates: Coordinates | None = None
    tags: list[str] = Field(default_factory=list)
    family_score: float = Field(ge=0.0, le=1.0)
    food_score: float = Field(ge=0.0, le=1.0)
    weather_suitability: str
    fatigue_impact: str
    source_signals: list[SourceSignal]
    confidence: float = Field(ge=0.0, le=1.0)
```

- [ ] **Step 5: Implement emergency model**

Write `app/core/models/emergency.py`:

```python
from pydantic import BaseModel, Field


class EmergencyPlaybook(BaseModel):
    entries: dict[str, str] = Field(default_factory=dict)

    def answer(self, issue_type: str) -> str:
        return self.entries.get(
            issue_type,
            self.entries.get("default", "Contact local emergency services if safety is at risk."),
        )
```

- [ ] **Step 6: Implement trip request model**

Write `app/core/models/trip_request.py`:

```python
from datetime import date, timedelta

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
    live_data_enabled: bool = False

    @model_validator(mode="after")
    def validate_dates(self) -> "TripRequest":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self

    @property
    def trip_dates(self) -> list[date]:
        total_days = (self.end_date - self.start_date).days + 1
        return [self.start_date + timedelta(days=offset) for offset in range(total_days)]

    @classmethod
    def default_family_trip(cls) -> "TripRequest":
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
```

- [ ] **Step 7: Implement itinerary models**

Write `app/core/models/itinerary.py`:

```python
from datetime import date, datetime
from enum import StrEnum

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
    food_hint: str
    estimated_cost_level: str
    child_friendliness: float = Field(ge=0.0, le=1.0)
    fatigue_level: str
    source_refs: list[str]


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
    pros: list[str]
    cautions: list[str]
    estimated_budget_range: str
    confidence: float = Field(ge=0.0, le=1.0)


class ReplanChange(BaseModel):
    operation: str
    day: date
    explanation: str


class ReplanPatch(BaseModel):
    user_request: str
    affected_days: list[date]
    changes: list[ReplanChange]
    updated_schedule_items: list[ScheduleItem]
    explanation: str
    source_audit: list[SourceSignal]


class ItineraryBundle(BaseModel):
    request_summary: str
    assumptions: list[str]
    options: list[ItineraryOption]
    selected_option_id: OptionId | None = None
    emergency_playbook: dict[str, str]
    source_audit: list[SourceSignal]
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    @model_validator(mode="after")
    def require_three_options(self) -> "ItineraryBundle":
        ids = {option.id for option in self.options}
        required = {OptionId.BALANCED, OptionId.KID_EXPERIENCE, OptionId.FOOD_REST}
        if ids != required:
            raise ValueError("itinerary bundle must include balanced, kid_experience, and food_rest options")
        return self
```

- [ ] **Step 8: Export model symbols**

Write `app/core/models/__init__.py`:

```python
from app.core.models.emergency import EmergencyPlaybook
from app.core.models.itinerary import (
    ItineraryBundle,
    ItineraryDay,
    ItineraryOption,
    OptionId,
    ReplanChange,
    ReplanPatch,
    ScheduleItem,
)
from app.core.models.place import Coordinates, PlaceCandidate
from app.core.models.source import SourceSignal, SourceType
from app.core.models.trip_request import Traveler, TripRequest

__all__ = [
    "Coordinates",
    "EmergencyPlaybook",
    "ItineraryBundle",
    "ItineraryDay",
    "ItineraryOption",
    "OptionId",
    "PlaceCandidate",
    "ReplanChange",
    "ReplanPatch",
    "ScheduleItem",
    "SourceSignal",
    "SourceType",
    "Traveler",
    "TripRequest",
]
```

- [ ] **Step 9: Run tests**

Run: `python -m pytest tests/unit/test_models.py -v`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/core/models tests/unit/test_models.py
git commit -m "feat: add core trip models"
```

---

### Task 3: Local Fixtures and Fallback Data Source

**Files:**
- Create: `data/fixtures/busan_areas.json`
- Create: `data/fixtures/family_places.json`
- Create: `data/fixtures/restaurants.json`
- Create: `data/fixtures/rainy_day_options.json`
- Create: `data/fixtures/emergency_playbooks.json`
- Create: `data/fixtures/youtube_seed_2026.json`
- Create: `app/core/data_sources/base.py`
- Create: `app/core/data_sources/local_fixtures.py`
- Test: `tests/unit/test_fallback_sources.py`

- [ ] **Step 1: Write failing fallback tests**

Write `tests/unit/test_fallback_sources.py`:

```python
from app.core.data_sources.local_fixtures import LocalFixtureDataSource
from app.core.models import SourceType


def test_local_fixture_search_places_returns_source_signals() -> None:
    source = LocalFixtureDataSource("data/fixtures")

    places = source.search_places(query="beach", area="Haeundae", category="experience")

    assert places
    assert places[0].source_signals[0].source_type == SourceType.LOCAL_FIXTURE
    assert places[0].source_signals[0].fallback_used is True


def test_local_fixture_emergency_help_has_late_night_pharmacy() -> None:
    source = LocalFixtureDataSource("data/fixtures")

    answer = source.get_emergency_help(issue_type="late_night_pharmacy")

    assert "pharmacy" in answer.lower()
    assert "119" in source.get_emergency_help(issue_type="default")


def test_local_fixture_youtube_seed_is_2026_only() -> None:
    source = LocalFixtureDataSource("data/fixtures")

    videos = source.search_youtube_seed(query="부산 맛집")

    assert videos
    assert all(video.published_at.year == 2026 for video in videos if video.published_at)
```

- [ ] **Step 2: Run tests to verify failure**

Run: `python -m pytest tests/unit/test_fallback_sources.py -v`

Expected: FAIL because data source and fixtures do not exist.

- [ ] **Step 3: Create fixture JSON files**

Write `data/fixtures/family_places.json`, `restaurants.json`, `busan_areas.json`, `rainy_day_options.json`, `emergency_playbooks.json`, and `youtube_seed_2026.json` using the approved sample records from the design: Haeundae Beach, Busan Aquarium, Songdo Marine Cable Car, Gamcheon Culture Village, Haeundae milmyeon candidate, Seomyeon dwaeji gukbap candidate, Gwangalli ocean-view cafe candidate, Busan stay areas, rainy-day indoor options, emergency playbooks, and two 2026 YouTube seed records.

- [ ] **Step 4: Implement data source base types**

Write `app/core/data_sources/base.py`:

```python
from typing import Protocol

from app.core.models import PlaceCandidate, SourceSignal


class DataSourceError(RuntimeError):
    pass


class PlaceDataSource(Protocol):
    def search_places(self, query: str, area: str | None, category: str | None) -> list[PlaceCandidate]:
        pass


class EmergencyDataSource(Protocol):
    def get_emergency_help(self, issue_type: str) -> str:
        pass


class YouTubeSeedDataSource(Protocol):
    def search_youtube_seed(self, query: str) -> list[SourceSignal]:
        pass
```

- [ ] **Step 5: Implement local fixture source**

Write `app/core/data_sources/local_fixtures.py`:

```python
import json
from datetime import date
from pathlib import Path
from typing import Any

from app.core.models import PlaceCandidate, SourceSignal, SourceType


class LocalFixtureDataSource:
    def __init__(self, fixture_dir: str | Path) -> None:
        self.fixture_dir = Path(fixture_dir)

    def search_places(self, query: str, area: str | None = None, category: str | None = None) -> list[PlaceCandidate]:
        records = self._read_list("family_places.json") + self._read_list("restaurants.json")
        query_lower = query.lower()
        results: list[PlaceCandidate] = []
        for record in records:
            tags = [str(tag).lower() for tag in record.get("tags", [])]
            matches_query = query_lower in record["name"].lower() or query_lower in tags or not query
            matches_area = area is None or record["area"].lower() == area.lower()
            matches_category = category is None or record["category"].lower() == category.lower()
            if matches_query and matches_area and matches_category:
                results.append(self._place_from_record(record))
        return results

    def get_emergency_help(self, issue_type: str) -> str:
        playbook = self._read_dict("emergency_playbooks.json")
        return str(playbook.get(issue_type, playbook["default"]))

    def search_youtube_seed(self, query: str) -> list[SourceSignal]:
        query_lower = query.lower()
        videos = []
        for record in self._read_list("youtube_seed_2026.json"):
            keywords = [str(keyword).lower() for keyword in record.get("extracted_keywords", [])]
            if query_lower and query_lower not in record["title"].lower() and query_lower not in keywords:
                continue
            videos.append(
                SourceSignal(
                    source_type=SourceType.YOUTUBE,
                    title=record["title"],
                    url=record.get("url"),
                    published_at=date.fromisoformat(record["published_at"]),
                    channel_name=record.get("channel_name"),
                    extracted_keywords=record.get("extracted_keywords", []),
                    matched_place_names=record.get("matched_place_names", []),
                    confidence_impact=record.get("confidence_impact", 0.0),
                    live_signal=True,
                    fallback_used=True,
                )
            )
        return videos

    def _place_from_record(self, record: dict[str, Any]) -> PlaceCandidate:
        signal = SourceSignal(
            source_type=SourceType.LOCAL_FIXTURE,
            title=f"local fixture: {record['name']}",
            confidence_impact=0.1,
            fallback_used=True,
        )
        return PlaceCandidate(
            name=record["name"],
            area=record["area"],
            category=record["category"],
            tags=record.get("tags", []),
            family_score=record["family_score"],
            food_score=record["food_score"],
            weather_suitability=record["weather_suitability"],
            fatigue_impact=record["fatigue_impact"],
            source_signals=[signal],
            confidence=record["confidence"],
        )

    def _read_list(self, filename: str) -> list[dict[str, Any]]:
        with (self.fixture_dir / filename).open(encoding="utf-8") as file:
            return json.load(file)

    def _read_dict(self, filename: str) -> dict[str, Any]:
        with (self.fixture_dir / filename).open(encoding="utf-8") as file:
            return json.load(file)
```

- [ ] **Step 6: Run tests**

Run: `python -m pytest tests/unit/test_fallback_sources.py -v`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/core/data_sources data/fixtures tests/unit/test_fallback_sources.py
git commit -m "feat: add local fixture data source"
```

---

### Task 4: YouTube Filtering, Ranking, and Tool Facade

**Files:**
- Create: `app/core/tools/youtube.py`
- Create: `app/core/data_sources/youtube_data_api.py`
- Create: `app/core/scoring/confidence.py`
- Test: `tests/unit/test_youtube_filter.py`

- [ ] **Step 1: Write failing YouTube tests**

Write `tests/unit/test_youtube_filter.py`:

```python
from datetime import date

from app.core.models import SourceSignal, SourceType
from app.core.tools.youtube import filter_2026_youtube_signals, rank_video_signals


def test_filter_2026_youtube_signals_excludes_old_videos() -> None:
    signals = [
        SourceSignal(
            source_type=SourceType.YOUTUBE,
            title="2026 부산 가족여행",
            published_at=date(2026, 7, 1),
            confidence_impact=0.2,
            live_signal=True,
        ),
        SourceSignal(
            source_type=SourceType.YOUTUBE,
            title="local stable place fixture",
            published_at=date(2025, 7, 1),
            confidence_impact=0.1,
            live_signal=False,
        ),
    ]

    filtered = filter_2026_youtube_signals(signals)

    assert [signal.title for signal in filtered] == ["2026 부산 가족여행"]


def test_rank_video_signals_prefers_family_and_place_matches() -> None:
    signals = [
        SourceSignal(
            source_type=SourceType.YOUTUBE,
            title="2026 부산 혼자 술집 여행",
            published_at=date(2026, 5, 1),
            extracted_keywords=["술집"],
            matched_place_names=[],
            confidence_impact=0.1,
            live_signal=True,
        ),
        SourceSignal(
            source_type=SourceType.YOUTUBE,
            title="2026 부산 아이랑 해운대 가족여행",
            published_at=date(2026, 6, 1),
            extracted_keywords=["아이랑", "해운대", "가족여행"],
            matched_place_names=["Haeundae Beach"],
            confidence_impact=0.1,
            live_signal=True,
        ),
    ]

    ranked = rank_video_signals(signals, preferred_keywords=["아이랑", "가족여행", "해운대"])

    assert ranked[0].title == "2026 부산 아이랑 해운대 가족여행"
```

- [ ] **Step 2: Run tests to verify failure**

Run: `python -m pytest tests/unit/test_youtube_filter.py -v`

Expected: FAIL because `app.core.tools.youtube` does not exist.

- [ ] **Step 3: Implement confidence helper**

Write `app/core/scoring/confidence.py`:

```python
from app.core.models import SourceSignal


def clamp_confidence(value: float) -> float:
    return max(0.0, min(1.0, value))


def signal_score(signal: SourceSignal, preferred_keywords: list[str]) -> float:
    keyword_hits = len(set(signal.extracted_keywords).intersection(preferred_keywords))
    place_bonus = 0.1 * len(signal.matched_place_names)
    freshness_bonus = 0.2 if signal.published_at and signal.published_at.year == 2026 else -0.5
    return clamp_confidence(
        0.4 + signal.confidence_impact + (0.1 * keyword_hits) + place_bonus + freshness_bonus
    )
```

- [ ] **Step 4: Implement YouTube tool facade**

Write `app/core/tools/youtube.py`:

```python
from app.core.models import SourceSignal, SourceType
from app.core.scoring.confidence import signal_score


def filter_2026_youtube_signals(signals: list[SourceSignal]) -> list[SourceSignal]:
    return [
        signal
        for signal in signals
        if signal.source_type == SourceType.YOUTUBE
        and signal.live_signal
        and signal.published_at is not None
        and signal.published_at.year == 2026
    ]


def rank_video_signals(signals: list[SourceSignal], preferred_keywords: list[str]) -> list[SourceSignal]:
    filtered = filter_2026_youtube_signals(signals)
    return sorted(filtered, key=lambda signal: signal_score(signal, preferred_keywords), reverse=True)
```

- [ ] **Step 5: Implement optional YouTube Data API adapter skeleton**

Write `app/core/data_sources/youtube_data_api.py` with an `httpx`-based `YouTubeDataApiSource.search_travel_videos()` that calls `https://www.googleapis.com/youtube/v3/search`, passes `publishedAfter=2026-01-01T00:00:00Z`, converts snippets into `SourceSignal`, and skips any non-2026 result.

- [ ] **Step 6: Run tests**

Run: `python -m pytest tests/unit/test_youtube_filter.py -v`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/core/tools/youtube.py app/core/data_sources/youtube_data_api.py app/core/scoring/confidence.py tests/unit/test_youtube_filter.py
git commit -m "feat: add YouTube travel signal filtering"
```

---

### Task 5: Place Ranking and Planner Engine

**Files:**
- Create: `app/core/scoring/place_ranker.py`
- Create: `app/core/orchestration/planner_engine.py`
- Test: `tests/unit/test_ranker.py`
- Test: `tests/integration/test_planner_engine.py`

- [ ] **Step 1: Write failing ranking test**

Write `tests/unit/test_ranker.py`:

```python
from app.core.data_sources.local_fixtures import LocalFixtureDataSource
from app.core.scoring.place_ranker import rank_places


def test_rank_places_prefers_family_for_kid_option() -> None:
    source = LocalFixtureDataSource("data/fixtures")
    places = source.search_places(query="", area=None, category="experience")

    ranked = rank_places(places, option_id="kid_experience")

    assert ranked[0].family_score >= ranked[-1].family_score
```

- [ ] **Step 2: Write failing planner integration test**

Write `tests/integration/test_planner_engine.py`:

```python
from datetime import date

from app.core.models import OptionId, TripRequest
from app.core.orchestration.planner_engine import PlannerEngine


def test_planner_engine_generates_three_options_without_api_keys() -> None:
    engine = PlannerEngine.fixture_only()

    bundle = engine.generate(TripRequest.default_family_trip())

    assert {option.id for option in bundle.options} == {
        OptionId.BALANCED,
        OptionId.KID_EXPERIENCE,
        OptionId.FOOD_REST,
    }
    assert all(len(option.days) == 4 for option in bundle.options)
    assert bundle.options[0].days[0].date == date(2026, 8, 16)
    assert bundle.source_audit
    assert bundle.emergency_playbook["default"]
```

- [ ] **Step 3: Run tests to verify failure**

Run: `python -m pytest tests/unit/test_ranker.py tests/integration/test_planner_engine.py -v`

Expected: FAIL because ranker and planner engine do not exist.

- [ ] **Step 4: Implement ranker**

Write `app/core/scoring/place_ranker.py`:

```python
from app.core.models import PlaceCandidate


def rank_places(places: list[PlaceCandidate], option_id: str) -> list[PlaceCandidate]:
    def score(place: PlaceCandidate) -> float:
        if option_id == "kid_experience":
            return (place.family_score * 0.7) + (place.confidence * 0.3)
        if option_id == "food_rest":
            low_fatigue_bonus = 0.2 if place.fatigue_impact == "low" else 0.0
            return (place.food_score * 0.6) + (place.confidence * 0.2) + low_fatigue_bonus
        return (place.family_score * 0.35) + (place.food_score * 0.35) + (place.confidence * 0.3)

    return sorted(places, key=score, reverse=True)
```

- [ ] **Step 5: Implement planner engine**

Write `app/core/orchestration/planner_engine.py` with `PlannerEngine.fixture_only()` and `PlannerEngine.generate(request)`. The implementation must build `balanced`, `kid_experience`, and `food_rest` options, each with exactly one `ItineraryDay` for each date in `request.trip_dates`, use fixture-backed `PlaceCandidate` values, include source audit records, and include emergency playbook entries for `default`, `late_night_pharmacy`, `lost_item`, and `tired_child`.

- [ ] **Step 6: Run tests**

Run: `python -m pytest tests/unit/test_ranker.py tests/integration/test_planner_engine.py -v`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/core/scoring/place_ranker.py app/core/orchestration/planner_engine.py tests/unit/test_ranker.py tests/integration/test_planner_engine.py
git commit -m "feat: generate fixture-backed itinerary options"
```

---

### Task 6: Replanner Engine and Emergency Concierge

**Files:**
- Create: `app/core/orchestration/replanner_engine.py`
- Create: `app/core/tools/emergency.py`
- Test: `tests/integration/test_replanner_engine.py`

- [ ] **Step 1: Write failing replanner tests**

Write `tests/integration/test_replanner_engine.py`:

```python
from app.core.models import OptionId, TripRequest
from app.core.orchestration.planner_engine import PlannerEngine
from app.core.orchestration.replanner_engine import ReplannerEngine


def test_replanner_creates_rainy_day_patch() -> None:
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())
    selected = next(option for option in bundle.options if option.id == OptionId.BALANCED)
    replanner = ReplannerEngine.fixture_only()

    patch = replanner.replan(selected, "비 오면 실내 위주로 바꿔줘")

    assert patch.affected_days
    assert patch.updated_schedule_items
    assert "indoor" in patch.explanation.lower() or "실내" in patch.explanation


def test_replanner_handles_tired_child_request() -> None:
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())
    selected = next(option for option in bundle.options if option.id == OptionId.KID_EXPERIENCE)
    replanner = ReplannerEngine.fixture_only()

    patch = replanner.replan(selected, "아이가 힘들어하면 3일차를 줄여줘")

    assert patch.affected_days == [selected.days[2].date]
    assert "rest" in patch.explanation.lower() or "휴식" in patch.explanation
```

- [ ] **Step 2: Run tests to verify failure**

Run: `python -m pytest tests/integration/test_replanner_engine.py -v`

Expected: FAIL because replanner does not exist.

- [ ] **Step 3: Implement emergency tool**

Write `app/core/tools/emergency.py`:

```python
from app.core.data_sources.local_fixtures import LocalFixtureDataSource


def get_emergency_help(issue_type: str, source: LocalFixtureDataSource | None = None) -> str:
    fixture_source = source or LocalFixtureDataSource("data/fixtures")
    return fixture_source.get_emergency_help(issue_type)
```

- [ ] **Step 4: Implement replanner engine**

Write `app/core/orchestration/replanner_engine.py` with `ReplannerEngine.fixture_only()` and `replan(option, user_request)`. The implementation must detect rainy-day requests and child-fatigue requests, return a valid `ReplanPatch`, modify only one affected day, and preserve source audit through a local fixture signal.

- [ ] **Step 5: Run tests**

Run: `python -m pytest tests/integration/test_replanner_engine.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/core/orchestration/replanner_engine.py app/core/tools/emergency.py tests/integration/test_replanner_engine.py
git commit -m "feat: add shallow itinerary replanning"
```

---

### Task 7: JSON and Markdown Renderers plus CLI

**Files:**
- Create: `app/core/rendering/json_export.py`
- Create: `app/core/rendering/markdown_report.py`
- Create: `app/cli/main.py`
- Create: `outputs/.gitkeep`
- Test: `tests/integration/test_rendering_and_cli.py`

- [ ] **Step 1: Write failing renderer and CLI tests**

Write `tests/integration/test_rendering_and_cli.py`:

```python
from typer.testing import CliRunner

from app.cli.main import app
from app.core.models import TripRequest
from app.core.orchestration.planner_engine import PlannerEngine
from app.core.rendering.json_export import export_bundle_json
from app.core.rendering.markdown_report import render_markdown_report


def test_json_export_contains_three_options() -> None:
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())

    payload = export_bundle_json(bundle)

    assert '"balanced"' in payload
    assert '"kid_experience"' in payload
    assert '"food_rest"' in payload


def test_markdown_report_contains_family_trip_title() -> None:
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())

    markdown = render_markdown_report(bundle)

    assert "# Busan Family Travel Proposal" in markdown
    assert "Balanced Family Busan" in markdown


def test_cli_plan_outputs_markdown() -> None:
    runner = CliRunner()

    result = runner.invoke(app, ["plan", "--format", "markdown"])

    assert result.exit_code == 0
    assert "Busan Family Travel Proposal" in result.stdout
```

- [ ] **Step 2: Run tests to verify failure**

Run: `python -m pytest tests/integration/test_rendering_and_cli.py -v`

Expected: FAIL because renderers and CLI do not exist.

- [ ] **Step 3: Implement JSON exporter**

Write `app/core/rendering/json_export.py`:

```python
from app.core.models import ItineraryBundle


def export_bundle_json(bundle: ItineraryBundle) -> str:
    return bundle.model_dump_json(indent=2)
```

- [ ] **Step 4: Implement Markdown renderer**

Write `app/core/rendering/markdown_report.py` with `render_markdown_report(bundle)`. It must include the title `# Busan Family Travel Proposal`, assumptions, every option title, stay area, confidence, each day, schedule items, fallback plans, cautions, and 24-hour help entries.

- [ ] **Step 5: Implement CLI**

Write `app/cli/main.py`:

```python
import typer

from app.core.models import TripRequest
from app.core.orchestration.planner_engine import PlannerEngine
from app.core.rendering.json_export import export_bundle_json
from app.core.rendering.markdown_report import render_markdown_report

app = typer.Typer(help="Busan family travel planner")


@app.command()
def plan(format: str = typer.Option("markdown", help="Output format: markdown or json")) -> None:
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())
    if format == "json":
        typer.echo(export_bundle_json(bundle))
        return
    typer.echo(render_markdown_report(bundle))


def main() -> None:
    app()
```

- [ ] **Step 6: Create outputs marker**

Create `outputs/.gitkeep` as an empty file.

- [ ] **Step 7: Run tests**

Run: `python -m pytest tests/integration/test_rendering_and_cli.py -v`

Expected: PASS.

- [ ] **Step 8: Run manual CLI smoke**

Run: `python -m app.cli.main plan --format markdown`

Expected: stdout includes `# Busan Family Travel Proposal`.

- [ ] **Step 9: Commit**

```bash
git add app/core/rendering app/cli/main.py outputs/.gitkeep tests/integration/test_rendering_and_cli.py
git commit -m "feat: add itinerary export and CLI"
```

---

### Task 8: Thin CrewAI Role Definitions

**Files:**
- Create: `app/core/agents/*.py`
- Create: `app/core/orchestration/crew_runner.py`
- Test: `tests/unit/test_agent_roles.py`

- [ ] **Step 1: Write failing agent role tests**

Write `tests/unit/test_agent_roles.py`:

```python
from app.core.agents.trip_director import build_trip_director_role
from app.core.orchestration.crew_runner import CrewRunner


def test_trip_director_role_has_structured_output_instruction() -> None:
    role = build_trip_director_role()

    assert "structured JSON" in role["backstory"]
    assert role["name"] == "TripDirectorAgent"


def test_crew_runner_defaults_to_deterministic_mode() -> None:
    runner = CrewRunner()

    assert runner.mode == "deterministic"
```

- [ ] **Step 2: Run tests to verify failure**

Run: `python -m pytest tests/unit/test_agent_roles.py -v`

Expected: FAIL because agent role files do not exist.

- [ ] **Step 3: Implement role builders**

Create role-builder functions for `TripDirectorAgent`, `TransportAgent`, `StayAreaAgent`, `FoodAgent`, `ExperienceAgent`, `RiskAndFallbackAgent`, and `ConciergeAgent`. Each returns a dict with `name`, `goal`, and `backstory`. Every `backstory` must state that the agent returns structured JSON fragments and avoids booking automation.

- [ ] **Step 4: Implement deterministic crew runner adapter**

Write `app/core/orchestration/crew_runner.py`:

```python
class CrewRunner:
    def __init__(self, mode: str = "deterministic") -> None:
        self.mode = mode

    def is_live_agent_mode(self) -> bool:
        return self.mode == "crewai"
```

- [ ] **Step 5: Run tests**

Run: `python -m pytest tests/unit/test_agent_roles.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/core/agents app/core/orchestration/crew_runner.py tests/unit/test_agent_roles.py
git commit -m "feat: document agent roles in code"
```

---

### Task 9: Streamlit Local Web Planner

**Files:**
- Create: `app/web/streamlit_app.py`
- Test: `tests/integration/test_streamlit_import.py`

- [ ] **Step 1: Write failing import test**

Write `tests/integration/test_streamlit_import.py`:

```python
import importlib


def test_streamlit_app_imports_without_running_server() -> None:
    module = importlib.import_module("app.web.streamlit_app")

    assert hasattr(module, "render_app")
```

- [ ] **Step 2: Run test to verify failure**

Run: `python -m pytest tests/integration/test_streamlit_import.py -v`

Expected: FAIL because `render_app` does not exist.

- [ ] **Step 3: Implement Streamlit app**

Write `app/web/streamlit_app.py`:

```python
import streamlit as st

from app.core.models import OptionId, TripRequest
from app.core.orchestration.planner_engine import PlannerEngine
from app.core.orchestration.replanner_engine import ReplannerEngine
from app.core.rendering.markdown_report import render_markdown_report


def render_app() -> None:
    st.set_page_config(page_title="Busan Family Travel Planner", layout="wide")
    st.title("Busan Family Travel Planner")
    st.caption("Engine-first local planner for 2026-08-16 to 2026-08-19")

    request = TripRequest.default_family_trip()
    bundle = PlannerEngine.fixture_only().generate(request)

    selected_id = st.selectbox(
        "Choose itinerary option",
        options=[option.id.value for option in bundle.options],
        index=0,
    )
    selected = next(option for option in bundle.options if option.id == OptionId(selected_id))

    st.subheader(selected.title)
    st.write(selected.positioning)
    st.write(f"Recommended stay area: {selected.recommended_stay_area}")

    for day in selected.days:
        with st.expander(f"{day.date.isoformat()} - {day.theme}", expanded=True):
            st.write(day.route_summary)
            for item in day.schedule_items:
                st.markdown(f"- **{item.time_window}** {item.activity}")
                st.caption(f"Transport: {item.transport_hint}")
            st.info(day.fallback_plan)

    replan_request = st.text_input("Replanning request", value="비 오면 실내 위주로 바꿔줘")
    if st.button("Generate replan patch"):
        patch = ReplannerEngine.fixture_only().replan(selected, replan_request)
        st.json(patch.model_dump(mode="json"))

    markdown = render_markdown_report(bundle)
    st.download_button("Download Markdown", markdown, file_name="busan-family-travel-plan.md")


if __name__ == "__main__":
    render_app()
```

- [ ] **Step 4: Run import test**

Run: `python -m pytest tests/integration/test_streamlit_import.py -v`

Expected: PASS.

- [ ] **Step 5: Run local manual smoke**

Run: `python -m streamlit run app/web/streamlit_app.py`

Expected: Streamlit prints a local URL and the page shows itinerary options.

- [ ] **Step 6: Commit**

```bash
git add app/web/streamlit_app.py tests/integration/test_streamlit_import.py
git commit -m "feat: add local Streamlit planner"
```

---

### Task 10: README, Sample Output, CI, and Final Verification

**Files:**
- Create: `README.md`
- Create: `.github/workflows/ci.yml`
- Create: `outputs/sample-busan-family-plan.md`
- Create: `outputs/sample-busan-family-plan.json`
- Modify: `.gitignore`
- Test: full suite and CLI smoke

- [ ] **Step 1: Update `.gitignore` to keep sample outputs**

Modify `.gitignore` so generated outputs are ignored but sample outputs are tracked:

```gitignore
outputs/*.json
outputs/*.md
!outputs/sample-busan-family-plan.json
!outputs/sample-busan-family-plan.md
!outputs/.gitkeep
```

- [ ] **Step 2: Generate sample outputs**

Run:

```bash
python -m app.cli.main plan --format markdown > outputs/sample-busan-family-plan.md
python -m app.cli.main plan --format json > outputs/sample-busan-family-plan.json
```

Expected: both files are created and contain the default trip.

- [ ] **Step 3: Write README**

Write `README.md`:

```markdown
# Summer Vacation In Busan

Engine-first Busan family travel planner for a Seoul Station to Busan family trip from 2026-08-16 to 2026-08-19.

## What It Does

- Generates three itinerary options: balanced, kid experience, and food/rest.
- Supports shallow replanning for requests such as rainy-day changes or child fatigue.
- Runs without API keys using local fixtures.
- Keeps optional live-source hooks for YouTube, places, and weather data.
- Exports Markdown and JSON.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -e .[dev]
```

## CLI Demo

```bash
python -m app.cli.main plan --format markdown
python -m app.cli.main plan --format json
```

## Web Demo

```bash
python -m streamlit run app/web/streamlit_app.py
```

## Optional API Keys

Copy `.env.example` to `.env` and fill the keys you want to use. The planner still works without keys.

## Verification

```bash
python -m pytest -v
```

## MVP Limits

This project does not book KTX tickets, hotels, restaurants, or paid experiences. It generates planning guidance and flags real-time details that must be confirmed before travel.
```

- [ ] **Step 4: Add GitHub Actions CI**

Write `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install
        run: python -m pip install -e .[dev]
      - name: Test
        run: python -m pytest -v
```

- [ ] **Step 5: Run full verification**

Run: `python -m pytest -v`

Expected: all tests pass.

Run: `python -m app.cli.main plan --format markdown`

Expected: stdout includes `# Busan Family Travel Proposal`.

Run: `python -m app.cli.main plan --format json`

Expected: stdout contains `"balanced"`, `"kid_experience"`, and `"food_rest"`.

- [ ] **Step 6: Commit**

```bash
git add README.md .github/workflows/ci.yml .gitignore outputs/sample-busan-family-plan.md outputs/sample-busan-family-plan.json
git commit -m "docs: add demo instructions and CI"
```

- [ ] **Step 7: Push**

Run: `git push`

Expected: local commits are pushed to `origin/main`.

---

## Plan Self-Review

- Spec coverage: Tasks cover scaffold, models, fixtures, hybrid fallback, YouTube 2026 filtering, ranking, planner, replanner, renderers, CLI, Streamlit app, README, samples, and CI.
- Out-of-scope guard: Booking, payment, KTX automation, mobile app, collaborative editing, calendar integration, offline companion, and advanced map editing are not implemented.
- Type consistency: The plan uses `TripRequest`, `SourceSignal`, `PlaceCandidate`, `ItineraryBundle`, `ItineraryOption`, `ScheduleItem`, `ReplanPatch`, and `OptionId` consistently across tests and implementation snippets.
- Validation coverage: Tests assert four trip days, three option IDs, YouTube 2026 filtering, fallback sources, planner output, replanning patches, rendering, CLI output, and Streamlit import safety.
- Execution mode: The recommended execution approach is subagent-driven development, one task at a time with review between tasks.
