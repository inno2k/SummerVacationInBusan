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
            title="2025 Busan food video",
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
