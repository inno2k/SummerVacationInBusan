from datetime import date

from app.core.models import OptionId, TripRequest
from app.core.orchestration.planner_engine import PlannerEngine
from app.core.orchestration.replanner import Replanner


def test_replanner_creates_rain_patch_for_selected_option() -> None:
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())
    bundle.selected_option_id = OptionId.KID_EXPERIENCE

    patch = Replanner.fixture_only().replan(
        bundle=bundle,
        user_request="8/17 비가 많이 오면 어떻게 바꿀까?",
        target_date=date(2026, 8, 17),
    )

    assert patch.affected_days == [date(2026, 8, 17)]
    assert patch.changes[0].operation == "replace_time_block"
    assert "rain" in patch.explanation.casefold()
    assert patch.updated_schedule_items[0].place.weather_suitability == "indoor"
    assert patch.source_audit


def test_replanner_emergency_answer_uses_safe_fallback() -> None:
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())

    answer = Replanner.fixture_only().emergency_answer(bundle, "unknown_issue")

    assert "119" in answer
