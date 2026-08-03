import json

from app.core.models import TripRequest
from app.core.orchestration.planner_engine import PlannerEngine
from app.core.orchestration.replanner import Replanner
from app.core.rendering import render_itinerary_markdown, render_json, render_replan_markdown


def test_render_json_outputs_parseable_model_payload() -> None:
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())

    payload = json.loads(render_json(bundle))

    assert payload["request_summary"].startswith("Seoul Station to Busan")
    assert len(payload["options"]) == 3


def test_render_itinerary_markdown_includes_options_and_fallbacks() -> None:
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())

    rendered = render_itinerary_markdown(bundle)

    assert "# Busan Family Travel Plan" in rendered
    assert "Balanced Family Busan" in rendered
    assert "Fallback:" in rendered


def test_render_replan_markdown_includes_patch_details() -> None:
    bundle = PlannerEngine.fixture_only().generate(TripRequest.default_family_trip())
    patch = Replanner.fixture_only().replan(bundle, "비가 오면 바꿔줘")

    rendered = render_replan_markdown(patch)

    assert "# Busan Replan Patch" in rendered
    assert "Updated Blocks" in rendered
