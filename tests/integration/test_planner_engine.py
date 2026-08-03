from datetime import date

from app.core.models import OptionId, Traveler, TripRequest
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
    source_keys = [(source.source_type, source.title) for source in bundle.source_audit]
    assert len(source_keys) == len(set(source_keys))
    assert bundle.emergency_playbook["default"]
    assert all(option.cautions for option in bundle.options)
    assert all(
        item.source_refs
        for option in bundle.options
        for day in option.days
        for item in day.schedule_items
    )
    assert all(
        len(item.source_refs) >= 2
        for option in bundle.options
        for day in option.days
        for item in day.schedule_items
    )
    assert all(
        any("Candidate" in source_ref for source_ref in item.source_refs)
        for option in bundle.options
        for day in option.days
        for item in day.schedule_items
    )


def test_planner_engine_generates_one_day_per_requested_date() -> None:
    request = TripRequest(
        origin="Seoul Station",
        destination="Busan",
        start_date=date(2026, 8, 16),
        end_date=date(2026, 8, 20),
        travelers=[Traveler(label="Father", age=46)],
    )

    bundle = PlannerEngine.fixture_only().generate(request)

    assert all(len(option.days) == len(request.trip_dates) for option in bundle.options)
    assert bundle.options[0].days[-1].date == date(2026, 8, 20)
