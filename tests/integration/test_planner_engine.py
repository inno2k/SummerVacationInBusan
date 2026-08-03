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
    assert all(option.cautions for option in bundle.options)
    assert all(
        item.source_refs
        for option in bundle.options
        for day in option.days
        for item in day.schedule_items
    )
